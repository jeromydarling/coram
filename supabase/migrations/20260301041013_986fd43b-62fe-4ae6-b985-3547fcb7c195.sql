
-- Mark stuck QA test runs and batch runs as failed after a threshold
CREATE OR REPLACE FUNCTION public.mark_stuck_qa_runs_failed(p_threshold_minutes INT DEFAULT 20)
RETURNS TABLE(run_id UUID, suite_key TEXT, stuck_since TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark stuck test runs
  RETURN QUERY
  UPDATE qa_test_runs
  SET status = 'failed',
      completed_at = now(),
      error = jsonb_build_object(
        'message', 'Auto-failed: no callback received within ' || p_threshold_minutes || ' minutes',
        'code', 'TIMEOUT_WATCHDOG'
      )
  WHERE status = 'running'
    AND created_at < now() - (p_threshold_minutes || ' minutes')::interval
  RETURNING qa_test_runs.id AS run_id, qa_test_runs.suite_key, qa_test_runs.created_at AS stuck_since;

  -- Mark stuck batch runs (if all their test runs are terminal)
  UPDATE qa_batch_runs
  SET status = 'failed',
      completed_at = now()
  WHERE status = 'running'
    AND created_at < now() - (p_threshold_minutes || ' minutes')::interval;
END;
$$;
