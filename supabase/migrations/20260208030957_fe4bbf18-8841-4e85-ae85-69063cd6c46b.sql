
-- RPC: get_due_watchlist — returns due crawl targets with daily cap enforcement
CREATE OR REPLACE FUNCTION public.get_due_watchlist(p_limit int DEFAULT 5, p_daily_cap int DEFAULT 50)
RETURNS TABLE(
  id uuid,
  org_id uuid,
  website_url text,
  cadence text,
  last_crawled_at timestamptz,
  tags jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_today_count int;
BEGIN
  -- Count today's crawl runs to enforce daily cap
  SELECT count(*)::int INTO v_today_count
  FROM automation_runs
  WHERE workflow_key = 'watchlist_ingest'
    AND created_at >= date_trunc('day', now())
    AND status NOT IN ('error');

  -- If cap exceeded, return empty
  IF v_today_count >= p_daily_cap THEN
    RETURN;
  END IF;

  -- Calculate remaining budget
  RETURN QUERY
  SELECT w.id, w.org_id, w.website_url, w.cadence, w.last_crawled_at, w.tags
  FROM org_watchlist w
  WHERE w.enabled = true
    AND w.cadence != 'manual'
    AND (
      (w.cadence = 'daily' AND (w.last_crawled_at IS NULL OR w.last_crawled_at < now() - interval '24 hours'))
      OR
      (w.cadence = 'weekly' AND (w.last_crawled_at IS NULL OR w.last_crawled_at < now() - interval '7 days'))
    )
  ORDER BY w.last_crawled_at ASC NULLS FIRST
  LIMIT LEAST(p_limit, p_daily_cap - v_today_count);
END;
$$;

-- RPC: get_recent_watchlist_signals — returns signals for recommendations input
CREATE OR REPLACE FUNCTION public.get_recent_watchlist_signals(
  p_window_hours int DEFAULT 168,
  p_limit int DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  org_id uuid,
  diff_id uuid,
  snapshot_id uuid,
  signal_type text,
  summary text,
  confidence numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- RBAC: require authenticated role
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT s.id, s.org_id, s.diff_id, s.snapshot_id,
         s.signal_type, s.summary, s.confidence, s.created_at
  FROM org_watchlist_signals s
  WHERE s.created_at >= now() - (p_window_hours || ' hours')::interval
  ORDER BY s.created_at DESC
  LIMIT LEAST(p_limit, 200);
END;
$$;
