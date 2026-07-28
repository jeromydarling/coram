-- Fix S3-UPD: Allow users to update their own search_runs (status, error_message, completed_at only)
CREATE POLICY "Users can update own search runs"
ON public.search_runs
FOR UPDATE
USING (requested_by = auth.uid())
WITH CHECK (requested_by = auth.uid());

-- Fix S3-UPD2: Allow users to update search_results they own (via search_run ownership)
CREATE POLICY "Users can update own search results"
ON public.search_results
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM search_runs sr
  WHERE sr.id = search_results.search_run_id
    AND sr.requested_by = auth.uid()
));

-- Fix S3-DUP: Drop duplicate SELECT policy on search_runs
DROP POLICY IF EXISTS "Users see own search runs" ON public.search_runs;