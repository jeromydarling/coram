
-- Add dispatch-specific columns to automation_runs
ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope_json jsonb;
