
-- F1: Search Memory Merge - add merged results tracking
ALTER TABLE public.search_runs ADD COLUMN IF NOT EXISTS merged_results_count integer DEFAULT 0;
ALTER TABLE public.search_runs ADD COLUMN IF NOT EXISTS prior_runs_merged integer DEFAULT 0;

-- F3: AI Briefing Panel - briefing field (search_brief already exists, add briefing as alias/separate)
-- search_brief already exists as jsonb on search_runs, so we use that. No new column needed.

-- Create index for search memory merge lookups
CREATE INDEX IF NOT EXISTS idx_search_runs_merge_lookup 
  ON public.search_runs (search_type, status, created_at DESC)
  WHERE status = 'completed';
