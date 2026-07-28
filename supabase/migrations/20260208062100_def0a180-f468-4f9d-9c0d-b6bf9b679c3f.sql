
-- Phase: Permanent org knowledge with versioning

-- Add new columns to org_knowledge_snapshots
ALTER TABLE public.org_knowledge_snapshots 
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'admin_curated',
  ADD COLUMN IF NOT EXISTS is_authoritative boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS replaced_by uuid NULL REFERENCES public.org_knowledge_snapshots(id),
  ADD COLUMN IF NOT EXISTS notes text NULL;

-- Add check constraint for source_type
ALTER TABLE public.org_knowledge_snapshots
  ADD CONSTRAINT org_knowledge_snapshots_source_type_check
  CHECK (source_type IN ('admin_curated', 'firecrawl_bootstrap'));

-- Make fresh_until nullable (deprecate TTL)
ALTER TABLE public.org_knowledge_snapshots ALTER COLUMN fresh_until DROP NOT NULL;

-- Create partial unique index: one active authoritative snapshot per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_knowledge_one_active_per_org
  ON public.org_knowledge_snapshots (org_id)
  WHERE active = true AND is_authoritative = true;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_org_knowledge_snapshots_active 
  ON public.org_knowledge_snapshots (org_id, active);

-- Create view for current org knowledge
CREATE OR REPLACE VIEW public.org_knowledge_current_v AS
SELECT
  s.org_id,
  s.id AS snapshot_id,
  s.version,
  s.structured_json,
  s.raw_excerpt,
  s.source_type,
  s.source_url,
  s.created_by,
  s.created_at,
  s.updated_at
FROM public.org_knowledge_snapshots s
WHERE s.active = true AND s.is_authoritative = true;

-- RLS policies for org_knowledge_snapshots (update existing)
-- Read: authenticated users can read
DROP POLICY IF EXISTS "Authenticated users can read org knowledge" ON public.org_knowledge_snapshots;
CREATE POLICY "Authenticated users can read org knowledge"
  ON public.org_knowledge_snapshots FOR SELECT TO authenticated
  USING (true);

-- Write: admin only (enforced in edge functions, but also at DB level)
DROP POLICY IF EXISTS "Admins can insert org knowledge" ON public.org_knowledge_snapshots;
CREATE POLICY "Admins can insert org knowledge"
  ON public.org_knowledge_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update org knowledge" ON public.org_knowledge_snapshots;
CREATE POLICY "Admins can update org knowledge"
  ON public.org_knowledge_snapshots FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete org knowledge" ON public.org_knowledge_snapshots;
CREATE POLICY "Admins can delete org knowledge"
  ON public.org_knowledge_snapshots FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
