
-- Indexes for automation_runs health queries
CREATE INDEX IF NOT EXISTS idx_automation_runs_workflow_created 
  ON public.automation_runs (workflow_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status_created 
  ON public.automation_runs (status, created_at DESC);

-- RPC: get_automation_health
CREATE OR REPLACE FUNCTION public.get_automation_health(
  p_workflow_key text DEFAULT NULL,
  p_window_hours int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_cutoff timestamptz;
BEGIN
  -- RBAC: only admin, leadership, regional_lead
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin', 'leadership', 'regional_lead']::app_role[]) THEN
    RAISE EXCEPTION 'Access denied: insufficient role';
  END IF;

  v_cutoff := now() - (p_window_hours || ' hours')::interval;

  SELECT jsonb_build_object(
    'window_hours', p_window_hours,

    'counts_by_workflow', COALESCE((
      SELECT jsonb_agg(row_to_json(c))
      FROM (
        SELECT 
          workflow_key,
          count(*)::int AS total,
          count(*) FILTER (WHERE status = 'processed')::int AS processed,
          count(*) FILTER (WHERE status = 'error')::int AS error,
          count(*) FILTER (WHERE status = 'running')::int AS running,
          count(*) FILTER (WHERE status = 'dispatched')::int AS dispatched
        FROM automation_runs
        WHERE created_at >= v_cutoff
          AND (p_workflow_key IS NULL OR workflow_key = p_workflow_key)
        GROUP BY workflow_key
        ORDER BY workflow_key
      ) c
    ), '[]'::jsonb),

    'error_rate_by_workflow', COALESCE((
      SELECT jsonb_agg(row_to_json(e))
      FROM (
        SELECT 
          workflow_key,
          ROUND(
            count(*) FILTER (WHERE status = 'error')::numeric 
            / NULLIF(count(*), 0) * 100, 1
          ) AS error_rate
        FROM automation_runs
        WHERE created_at >= v_cutoff
          AND (p_workflow_key IS NULL OR workflow_key = p_workflow_key)
        GROUP BY workflow_key
        ORDER BY workflow_key
      ) e
    ), '[]'::jsonb),

    'avg_duration_seconds_by_workflow', COALESCE((
      SELECT jsonb_agg(row_to_json(d))
      FROM (
        SELECT 
          workflow_key,
          ROUND(
            avg(EXTRACT(EPOCH FROM (processed_at - created_at)))::numeric, 1
          ) AS avg_duration_seconds
        FROM automation_runs
        WHERE created_at >= v_cutoff
          AND processed_at IS NOT NULL
          AND (p_workflow_key IS NULL OR workflow_key = p_workflow_key)
        GROUP BY workflow_key
        ORDER BY workflow_key
      ) d
    ), '[]'::jsonb),

    'latest_by_workflow', COALESCE((
      SELECT jsonb_agg(row_to_json(l))
      FROM (
        SELECT DISTINCT ON (workflow_key)
          workflow_key, run_id, status, created_at, processed_at, error_message, triggered_by
        FROM automation_runs
        WHERE (p_workflow_key IS NULL OR workflow_key = p_workflow_key)
        ORDER BY workflow_key, created_at DESC
      ) l
    ), '[]'::jsonb),

    'stuck_runs', COALESCE((
      SELECT jsonb_agg(row_to_json(s))
      FROM (
        SELECT run_id, workflow_key, created_at, status
        FROM automation_runs
        WHERE status IN ('running', 'dispatched')
          AND created_at < now() - interval '10 minutes'
          AND (p_workflow_key IS NULL OR workflow_key = p_workflow_key)
        ORDER BY created_at ASC
        LIMIT 50
      ) s
    ), '[]'::jsonb),

    'recent_runs', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT run_id, workflow_key, status, created_at, processed_at, error_message, triggered_by
        FROM automation_runs
        WHERE created_at >= v_cutoff
          AND (p_workflow_key IS NULL OR workflow_key = p_workflow_key)
        ORDER BY created_at DESC
        LIMIT 50
      ) r
    ), '[]'::jsonb),

    'recent_errors', COALESCE((
      SELECT jsonb_agg(row_to_json(re))
      FROM (
        SELECT run_id, workflow_key, status, created_at, processed_at, error_message, triggered_by
        FROM automation_runs
        WHERE status = 'error'
          AND created_at >= v_cutoff
          AND (p_workflow_key IS NULL OR workflow_key = p_workflow_key)
        ORDER BY created_at DESC
        LIMIT 20
      ) re
    ), '[]'::jsonb)

  ) INTO v_result;

  RETURN v_result;
END;
$$;
