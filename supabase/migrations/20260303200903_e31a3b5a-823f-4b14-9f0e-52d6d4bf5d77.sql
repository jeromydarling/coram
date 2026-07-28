-- Add enrichment and detail columns to operator_opportunities
ALTER TABLE public.operator_opportunities
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS partner_tier text,
  ADD COLUMN IF NOT EXISTS partner_tiers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mission_snapshot text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS best_partnership_angle text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS grant_alignment text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS org_knowledge_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS org_enrichment_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS neighborhood_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS enrichment_run_id text,
  ADD COLUMN IF NOT EXISTS website_url text;

-- Copy existing website values to website_url for consistency
UPDATE public.operator_opportunities SET website_url = website WHERE website IS NOT NULL AND website_url IS NULL;