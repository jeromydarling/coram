
-- F1: Add enrichment status tracking to opportunities
-- source_url already exists as website_url, so we add status columns

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS org_knowledge_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS neighborhood_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS org_enrichment_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_run_id text;

-- Add check constraints for valid statuses
ALTER TABLE public.opportunities
  ADD CONSTRAINT chk_org_knowledge_status CHECK (org_knowledge_status IN ('none', 'queued', 'processing', 'completed', 'failed')),
  ADD CONSTRAINT chk_neighborhood_status CHECK (neighborhood_status IN ('none', 'queued', 'processing', 'completed', 'failed')),
  ADD CONSTRAINT chk_org_enrichment_status CHECK (org_enrichment_status IN ('none', 'queued', 'processing', 'completed', 'failed'));

-- Index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_opportunities_enrichment_status 
  ON public.opportunities (org_enrichment_status) 
  WHERE org_enrichment_status IN ('queued', 'processing');

COMMENT ON COLUMN public.opportunities.org_knowledge_status IS 'Status of org knowledge bootstrap enrichment';
COMMENT ON COLUMN public.opportunities.neighborhood_status IS 'Status of neighborhood insights enrichment';
COMMENT ON COLUMN public.opportunities.org_enrichment_status IS 'Status of org contacts/metadata enrichment';
COMMENT ON COLUMN public.opportunities.enrichment_run_id IS 'Links to automation_runs.run_id for the enrichment chain';
