
-- Add dispatch_payload column to store original scoped payload for retries
-- and parent_run_id to link retried runs
ALTER TABLE public.automation_runs 
  ADD COLUMN IF NOT EXISTS dispatch_payload jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_run_id text DEFAULT NULL;

-- Index for finding child runs
CREATE INDEX IF NOT EXISTS idx_automation_runs_parent_run_id 
  ON public.automation_runs (parent_run_id) WHERE parent_run_id IS NOT NULL;
