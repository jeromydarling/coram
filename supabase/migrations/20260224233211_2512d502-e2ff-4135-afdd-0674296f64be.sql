
-- ============================================================
-- PART 3-4: Living Library + Gardener Discovery Insights
-- ============================================================

-- 1) library_essays
CREATE TABLE public.library_essays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  month_key text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  sector text NOT NULL DEFAULT 'general',
  source_type text NOT NULL DEFAULT 'manual',
  voice_profile text NOT NULL DEFAULT 'cros_default',
  content_markdown text,
  excerpt text,
  seo_title text,
  seo_description text,
  canonical_url text,
  schema_json jsonb,
  meta_robots text NOT NULL DEFAULT 'noindex,nofollow',
  tags text[] DEFAULT '{}',
  citations jsonb DEFAULT '[]',
  generated_by text NOT NULL DEFAULT 'NRI',
  approved_by uuid REFERENCES auth.users(id),
  published_at timestamptz
);

CREATE OR REPLACE FUNCTION public.validate_library_essay_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft','ready_for_review','published','archived') THEN
    RAISE EXCEPTION 'Invalid library_essays status: %', NEW.status;
  END IF;
  IF NEW.sector NOT IN ('nonprofit','catholic','christian','ministry','general') THEN
    RAISE EXCEPTION 'Invalid library_essays sector: %', NEW.sector;
  END IF;
  IF NEW.source_type NOT IN ('rss','tenant_movement','manual') THEN
    RAISE EXCEPTION 'Invalid library_essays source_type: %', NEW.source_type;
  END IF;
  IF NEW.voice_profile NOT IN ('cros_default','catholic_outreach','nonprofit_general') THEN
    RAISE EXCEPTION 'Invalid library_essays voice_profile: %', NEW.voice_profile;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_library_essay
  BEFORE INSERT OR UPDATE ON public.library_essays
  FOR EACH ROW EXECUTE FUNCTION public.validate_library_essay_status();

CREATE TRIGGER update_library_essays_updated_at
  BEFORE UPDATE ON public.library_essays
  FOR EACH ROW EXECUTE FUNCTION public.update_operator_notif_settings_timestamp();

CREATE INDEX idx_library_essays_status ON public.library_essays (status);
CREATE INDEX idx_library_essays_month ON public.library_essays (month_key);

ALTER TABLE public.library_essays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published essays"
  ON public.library_essays FOR SELECT USING (status = 'published');

CREATE POLICY "Gardeners can read all essays"
  ON public.library_essays FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "Gardeners can insert essays"
  ON public.library_essays FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "Gardeners can update essays"
  ON public.library_essays FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- 2) library_essay_signals
CREATE TABLE public.library_essay_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  essay_id uuid NOT NULL REFERENCES public.library_essays(id) ON DELETE CASCADE,
  tenant_slug text,
  archetype_key text,
  enrichment_keywords text[] DEFAULT '{}',
  communio_opt_in boolean,
  communio_profile_strength int DEFAULT 0,
  discovery_topics text[] DEFAULT '{}',
  relational_lens_notes text
);

CREATE INDEX idx_essay_signals_essay ON public.library_essay_signals (essay_id);

ALTER TABLE public.library_essay_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can manage essay signals"
  ON public.library_essay_signals FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- 3) gardener_insights
CREATE TABLE public.gardener_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  title text NOT NULL,
  body text NOT NULL,
  suggested_next_steps jsonb DEFAULT '[]',
  related_links text[] DEFAULT '{}',
  source_refs jsonb DEFAULT '{}',
  dedupe_key text UNIQUE NOT NULL,
  dismissed_at timestamptz,
  dismissed_by uuid REFERENCES auth.users(id),
  snoozed_until timestamptz
);

CREATE OR REPLACE FUNCTION public.validate_gardener_insight()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('essay_ready','discovery_interest','adoption_friction','onboarding_dropoff','integration_interest') THEN
    RAISE EXCEPTION 'Invalid gardener_insights type: %', NEW.type;
  END IF;
  IF NEW.severity NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'Invalid gardener_insights severity: %', NEW.severity;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_gardener_insight
  BEFORE INSERT OR UPDATE ON public.gardener_insights
  FOR EACH ROW EXECUTE FUNCTION public.validate_gardener_insight();

CREATE INDEX idx_gardener_insights_type ON public.gardener_insights (type);
CREATE INDEX idx_gardener_insights_active ON public.gardener_insights (created_at DESC)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.gardener_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can read insights"
  ON public.gardener_insights FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "Gardeners can update insights"
  ON public.gardener_insights FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "System can insert insights"
  ON public.gardener_insights FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- 4) app_event_stream
CREATE TABLE public.app_event_stream (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid REFERENCES auth.users(id),
  session_hash text,
  event_name text NOT NULL,
  page_path text,
  referrer text,
  metadata jsonb DEFAULT '{}',
  is_error boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_app_events_name ON public.app_event_stream (event_name);
CREATE INDEX idx_app_events_created ON public.app_event_stream (created_at DESC);
CREATE INDEX idx_app_events_non_error ON public.app_event_stream (created_at DESC)
  WHERE is_error = false;

ALTER TABLE public.app_event_stream ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can log events"
  ON public.app_event_stream FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anonymous can log marketing events"
  ON public.app_event_stream FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND tenant_id IS NULL);

CREATE POLICY "Gardeners can read events"
  ON public.app_event_stream FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE OR REPLACE FUNCTION public.purge_old_app_events()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM app_event_stream WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
END; $$;
