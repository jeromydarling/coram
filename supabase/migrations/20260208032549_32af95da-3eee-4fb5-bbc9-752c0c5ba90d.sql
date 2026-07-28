
-- 1) Add website columns to opportunities table
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS website_domain text;

CREATE INDEX IF NOT EXISTS idx_opportunities_website_domain ON public.opportunities (website_domain);

-- 2) Add crawl_limit_metadata to automation_runs (reuse existing payload/scope_json for metadata)
-- No new columns needed - we'll use the existing scope_json field for limit metadata

-- 3) Add escalation tracking columns to org_watchlist_signals
ALTER TABLE public.org_watchlist_signals
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS llm_used boolean DEFAULT false;
