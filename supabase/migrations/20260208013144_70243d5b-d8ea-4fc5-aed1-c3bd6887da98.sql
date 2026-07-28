-- Add payload_fingerprint column for exactly-once dedupe
ALTER TABLE public.automation_runs
ADD COLUMN IF NOT EXISTS payload_fingerprint text;

-- Index for fast lookup during dedupe check
CREATE INDEX IF NOT EXISTS idx_automation_runs_fingerprint
ON public.automation_runs (run_id, payload_fingerprint);
