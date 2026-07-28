
-- ============================================================
-- 1) usage_events — append-only metering table
-- ============================================================
CREATE TABLE public.usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT,
  workflow_key TEXT NOT NULL,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'count',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for aggregation queries (no expression index on date cast)
CREATE INDEX idx_usage_events_org_occurred ON public.usage_events (org_id, occurred_at);
CREATE INDEX idx_usage_events_workflow ON public.usage_events (workflow_key, occurred_at DESC);
CREATE INDEX idx_usage_events_run ON public.usage_events (run_id);

-- RLS: only service role can write; admin/leadership can read
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on usage_events"
  ON public.usage_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin/leadership can read usage_events"
  ON public.usage_events FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  );

-- ============================================================
-- 2) Aggregation views
-- ============================================================
CREATE OR REPLACE VIEW public.usage_daily_by_org AS
SELECT
  org_id,
  (occurred_at AT TIME ZONE 'UTC')::date AS usage_date,
  event_type,
  unit,
  SUM(quantity) AS total_quantity,
  COUNT(*) AS event_count
FROM public.usage_events
GROUP BY org_id, (occurred_at AT TIME ZONE 'UTC')::date, event_type, unit;

CREATE OR REPLACE VIEW public.usage_by_workflow AS
SELECT
  workflow_key,
  event_type,
  unit,
  SUM(quantity) AS total_quantity,
  COUNT(*) AS event_count,
  MIN(occurred_at) AS first_event,
  MAX(occurred_at) AS last_event
FROM public.usage_events
GROUP BY workflow_key, event_type, unit;

CREATE OR REPLACE VIEW public.usage_by_unit AS
SELECT
  unit,
  event_type,
  SUM(quantity) AS total_quantity,
  COUNT(*) AS event_count,
  (occurred_at AT TIME ZONE 'UTC')::date AS usage_date
FROM public.usage_events
GROUP BY unit, event_type, (occurred_at AT TIME ZONE 'UTC')::date;

-- ============================================================
-- 3) mark_stuck_runs_failed — watchdog RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_stuck_runs_failed(
  p_threshold_minutes INT DEFAULT 30
)
RETURNS TABLE(run_id TEXT, workflow_key TEXT, stuck_since TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE automation_runs ar
  SET 
    status = 'failed_timeout',
    error_message = 'Auto-marked failed: no callback after ' || p_threshold_minutes || ' minutes',
    processed_at = now()
  WHERE ar.status IN ('dispatched', 'running')
    AND ar.created_at < now() - (p_threshold_minutes || ' minutes')::interval
  RETURNING ar.run_id, ar.workflow_key, ar.created_at;
END;
$$;

-- ============================================================
-- 4) Usage cap check RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_usage_cap(
  p_org_id TEXT,
  p_unit TEXT DEFAULT 'firecrawl_page',
  p_daily_cap INT DEFAULT 100
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_today_total
  FROM public.usage_events
  WHERE org_id = p_org_id
    AND unit = p_unit
    AND occurred_at >= date_trunc('day', now());

  RETURN v_today_total < p_daily_cap;
END;
$$;
