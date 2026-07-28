
-- ============================================================
-- PHASE F6.5: Event Followup Campaign + Org Knowledge Snapshots
-- ============================================================

-- A1) Add import_batch_id to event_attendees
ALTER TABLE public.event_attendees
  ADD COLUMN IF NOT EXISTS import_batch_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_event_attendees_import_batch
  ON public.event_attendees (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

-- Drop old unique constraint if exists and add new one with import_batch_id
-- We use a partial unique to allow null import_batch_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendees_event_contact_batch
  ON public.event_attendees (event_id, raw_full_name, COALESCE(import_batch_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- B1) Org Knowledge Snapshots
CREATE TABLE IF NOT EXISTS public.org_knowledge_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  external_org_key text NULL,
  source_url text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  fresh_until timestamptz NOT NULL,
  model text NOT NULL,
  content_hash text NOT NULL,
  raw_excerpt text NOT NULL,
  structured_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_knowledge_snapshots_org
  ON public.org_knowledge_snapshots (org_id)
  WHERE org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_knowledge_snapshots_ext_key
  ON public.org_knowledge_snapshots (external_org_key)
  WHERE external_org_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_knowledge_snapshots_fresh
  ON public.org_knowledge_snapshots (fresh_until);

-- B1) Org Knowledge Sources
CREATE TABLE IF NOT EXISTS public.org_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.org_knowledge_snapshots(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text NULL,
  snippet text NULL,
  content_hash text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_knowledge_sources_snapshot
  ON public.org_knowledge_sources (snapshot_id);

-- RLS: org_knowledge_snapshots
ALTER TABLE public.org_knowledge_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read org knowledge snapshots"
  ON public.org_knowledge_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert org knowledge snapshots"
  ON public.org_knowledge_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update org knowledge snapshots"
  ON public.org_knowledge_snapshots FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete org knowledge snapshots"
  ON public.org_knowledge_snapshots FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS: org_knowledge_sources
ALTER TABLE public.org_knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read org knowledge sources"
  ON public.org_knowledge_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage org knowledge sources"
  ON public.org_knowledge_sources FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
