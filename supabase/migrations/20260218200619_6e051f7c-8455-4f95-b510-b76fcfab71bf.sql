
-- ═══════════════════════════════════════════════════════════
-- PHASE 6A: VOLUNTEERS + HOURS + INBOX + IMPORT CENTER
-- ═══════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 1) volunteers
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  last_volunteered_at timestamptz,
  lifetime_minutes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger instead of CHECK for status
CREATE OR REPLACE FUNCTION public.validate_volunteer_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid volunteer status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_volunteer_status_trigger
  BEFORE INSERT OR UPDATE ON public.volunteers
  FOR EACH ROW EXECUTE FUNCTION public.validate_volunteer_status();

CREATE TRIGGER update_volunteers_updated_at
  BEFORE UPDATE ON public.volunteers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_volunteers_email ON public.volunteers (email);
CREATE INDEX idx_volunteers_last_volunteered ON public.volunteers (last_volunteered_at DESC);
CREATE INDEX idx_volunteers_created ON public.volunteers (created_at DESC);

ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;

-- SELECT: all non-warehouse roles
CREATE POLICY "volunteers_select" ON public.volunteers FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead','staff']::app_role[]));

-- INSERT: same roles
CREATE POLICY "volunteers_insert" ON public.volunteers FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead','staff']::app_role[]));

-- UPDATE: same roles
CREATE POLICY "volunteers_update" ON public.volunteers FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead','staff']::app_role[]));

-- DELETE: admin/staff only
CREATE POLICY "volunteers_delete" ON public.volunteers FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','staff']::app_role[]));


-- ────────────────────────────────────────────────────────────
-- 2) volunteer_shifts
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.volunteer_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  kind text NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  minutes int NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  source_email_message_id text,
  raw_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_volunteer_shift()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.kind NOT IN ('warehouse', 'event') THEN
    RAISE EXCEPTION 'Invalid shift kind: %', NEW.kind;
  END IF;
  IF NEW.minutes <= 0 OR NEW.minutes > 1440 THEN
    RAISE EXCEPTION 'Minutes must be between 1 and 1440';
  END IF;
  IF NEW.source NOT IN ('manual', 'email') THEN
    RAISE EXCEPTION 'Invalid source: %', NEW.source;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_volunteer_shift_trigger
  BEFORE INSERT OR UPDATE ON public.volunteer_shifts
  FOR EACH ROW EXECUTE FUNCTION public.validate_volunteer_shift();

-- Dedupe: unique email message id
CREATE UNIQUE INDEX idx_volunteer_shifts_email_dedupe
  ON public.volunteer_shifts (source_email_message_id)
  WHERE source_email_message_id IS NOT NULL;

CREATE INDEX idx_volunteer_shifts_volunteer_date ON public.volunteer_shifts (volunteer_id, shift_date DESC);
CREATE INDEX idx_volunteer_shifts_event_date ON public.volunteer_shifts (event_id, shift_date DESC) WHERE event_id IS NOT NULL;
CREATE INDEX idx_volunteer_shifts_created ON public.volunteer_shifts (created_at DESC);

ALTER TABLE public.volunteer_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "volunteer_shifts_select" ON public.volunteer_shifts FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead','staff']::app_role[]));

CREATE POLICY "volunteer_shifts_insert" ON public.volunteer_shifts FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead','staff']::app_role[]));

-- UPDATE/DELETE: admin/staff OR creator
CREATE POLICY "volunteer_shifts_update" ON public.volunteer_shifts FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','staff']::app_role[])
    OR (created_by = auth.uid() AND source = 'manual')
  );

CREATE POLICY "volunteer_shifts_delete" ON public.volunteer_shifts FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','staff']::app_role[])
    OR (created_by = auth.uid() AND source = 'manual')
  );


-- ────────────────────────────────────────────────────────────
-- 3) Aggregate trigger: recompute volunteer stats on shift changes
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_volunteer_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_volunteer_id uuid;
BEGIN
  -- Determine which volunteer to update
  v_volunteer_id := COALESCE(NEW.volunteer_id, OLD.volunteer_id);

  UPDATE public.volunteers
  SET
    lifetime_minutes = COALESCE((
      SELECT SUM(minutes) FROM public.volunteer_shifts WHERE volunteer_id = v_volunteer_id
    ), 0),
    last_volunteered_at = (
      SELECT MAX(shift_date::timestamptz) FROM public.volunteer_shifts WHERE volunteer_id = v_volunteer_id
    )
  WHERE id = v_volunteer_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recompute_volunteer_stats_after_insert
  AFTER INSERT ON public.volunteer_shifts
  FOR EACH ROW EXECUTE FUNCTION public.recompute_volunteer_stats();

CREATE TRIGGER recompute_volunteer_stats_after_update
  AFTER UPDATE ON public.volunteer_shifts
  FOR EACH ROW EXECUTE FUNCTION public.recompute_volunteer_stats();

CREATE TRIGGER recompute_volunteer_stats_after_delete
  AFTER DELETE ON public.volunteer_shifts
  FOR EACH ROW EXECUTE FUNCTION public.recompute_volunteer_stats();


-- ────────────────────────────────────────────────────────────
-- 4) volunteer_hours_inbox (review queue)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.volunteer_hours_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text NOT NULL UNIQUE,
  from_email text NOT NULL,
  received_at timestamptz NOT NULL,
  subject text,
  snippet text,
  raw_text text NOT NULL,
  parsed_json jsonb NOT NULL DEFAULT '{}',
  parse_status text NOT NULL DEFAULT 'needs_review',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_inbox_parse_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parse_status NOT IN ('parsed', 'needs_review', 'rejected') THEN
    RAISE EXCEPTION 'Invalid parse_status: %', NEW.parse_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_inbox_parse_status_trigger
  BEFORE INSERT OR UPDATE ON public.volunteer_hours_inbox
  FOR EACH ROW EXECUTE FUNCTION public.validate_inbox_parse_status();

CREATE INDEX idx_inbox_status_received ON public.volunteer_hours_inbox (parse_status, received_at DESC);
CREATE INDEX idx_inbox_email_received ON public.volunteer_hours_inbox (from_email, received_at DESC);

ALTER TABLE public.volunteer_hours_inbox ENABLE ROW LEVEL SECURITY;

-- SELECT/UPDATE: admin/staff only
CREATE POLICY "volunteer_inbox_select" ON public.volunteer_hours_inbox FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','staff']::app_role[]));

CREATE POLICY "volunteer_inbox_update" ON public.volunteer_hours_inbox FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','staff']::app_role[]));

-- INSERT: allow service role (no user-facing insert policy; edge functions use service role)
-- We add a permissive policy for service-role inserts but restrict to admin for manual
CREATE POLICY "volunteer_inbox_insert" ON public.volunteer_hours_inbox FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','staff']::app_role[]));


-- ────────────────────────────────────────────────────────────
-- 5) IMPORT CENTER TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_system text NOT NULL DEFAULT 'generic_csv',
  import_type text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  stats jsonb NOT NULL DEFAULT '{}',
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE OR REPLACE FUNCTION public.validate_import_run_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('uploaded', 'mapped', 'previewed', 'importing', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid import_runs status: %', NEW.status;
  END IF;
  IF NEW.import_type NOT IN ('organizations', 'people', 'activities', 'tasks', 'deals', 'volunteers') THEN
    RAISE EXCEPTION 'Invalid import_type: %', NEW.import_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_import_run_status_trigger
  BEFORE INSERT OR UPDATE ON public.import_runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_import_run_status();

CREATE INDEX idx_import_runs_user ON public.import_runs (user_id, created_at DESC);
CREATE INDEX idx_import_runs_status ON public.import_runs (status, created_at DESC);

ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_runs_select" ON public.import_runs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "import_runs_insert" ON public.import_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]) AND user_id = auth.uid());

CREATE POLICY "import_runs_update" ON public.import_runs FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));


CREATE TABLE public.import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_files_select" ON public.import_files FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "import_files_insert" ON public.import_files FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));


CREATE TABLE public.import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  mapping jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_mappings_select" ON public.import_mappings FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "import_mappings_insert" ON public.import_mappings FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "import_mappings_update" ON public.import_mappings FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));


-- ────────────────────────────────────────────────────────────
-- 6) Storage bucket for import files
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('import-files', 'import-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "import_files_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'import-files' AND public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "import_files_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'import-files' AND public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));
