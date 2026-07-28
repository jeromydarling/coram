
-- Add metrics columns to search_runs
ALTER TABLE public.search_runs
  ADD COLUMN IF NOT EXISTS results_returned int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results_saved int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results_rejected int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS people_added_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opportunities_created_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS firecrawl_ms int NULL;

-- Ensure RLS: users can only SELECT their own runs
-- First check existing policies
DO $$
BEGIN
  -- Drop if exists to avoid conflicts
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'search_runs' AND policyname = 'Users can view own search runs') THEN
    DROP POLICY "Users can view own search runs" ON public.search_runs;
  END IF;
END $$;

CREATE POLICY "Users can view own search runs"
  ON public.search_runs
  FOR SELECT
  USING (requested_by = auth.uid());
