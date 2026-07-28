
-- ════════════════════════════════════════════════════════
-- PHASE 6A CONTINUATION — Retention, Cache, Pulse Recovery, Health Views
-- ════════════════════════════════════════════════════════

-- ─── PART 1: AUTOMATION RETENTION ───────────────────────

CREATE OR REPLACE FUNCTION public.archive_old_automation_runs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM automation_runs
  WHERE created_at < now() - interval '90 days'
    AND status IN ('processed', 'deduped', 'skipped_due_to_cap', 'rate_limited', 'throttled');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
END;
$$;

-- ─── PART 2: STORY EVENTS MATERIALIZED VIEW ────────────

DROP VIEW IF EXISTS public.story_events_view;

CREATE MATERIALIZED VIEW public.story_events_cache AS

SELECT 'reflection:'::text || r.id AS id,
    r.opportunity_id,
    'reflection'::text AS kind,
    'Reflection'::text AS title,
    left(regexp_replace(r.body, '<[^>]*>', '', 'g'), 280) AS summary,
    r.created_at AS occurred_at,
    r.visibility AS privacy_scope,
    r.author_id
FROM opportunity_reflections r
WHERE r.created_at >= now() - interval '365 days'

UNION ALL

SELECT 'email:'::text || e.id AS id,
    c.opportunity_id,
    'email'::text AS kind,
    COALESCE(NULLIF(e.subject, ''), left(COALESCE(e.snippet, '(no subject)'), 60)) AS title,
    left(COALESCE(e.snippet, ''), 280) AS summary,
    e.sent_at AS occurred_at,
    'private'::text AS privacy_scope,
    e.user_id AS author_id
FROM email_communications e
JOIN contacts c ON c.id = e.contact_id
WHERE c.opportunity_id IS NOT NULL
  AND e.sent_at >= now() - interval '365 days'

UNION ALL

SELECT ('campaign:'::text || a.campaign_id || '-' || a.id) AS id,
    a.opportunity_id,
    'campaign'::text AS kind,
    COALESCE(ec.name, 'Campaign') AS title,
    ('Subject: ' || COALESCE(ec.subject, 'N/A') || ' — ' || COALESCE(a.status, 'sent')) AS summary,
    a.sent_at AS occurred_at,
    'team'::text AS privacy_scope,
    NULL::uuid AS author_id
FROM email_campaign_audience a
JOIN email_campaigns ec ON ec.id = a.campaign_id
WHERE a.opportunity_id IS NOT NULL
  AND a.sent_at >= now() - interval '365 days'

UNION ALL

SELECT 'task:'::text || ra.id AS id,
    ra.opportunity_id,
    'task'::text AS kind,
    'Task: ' || COALESCE(ra.title, 'Untitled') AS title,
    COALESCE(ra.summary, '') AS summary,
    ra.created_at AS occurred_at,
    'team'::text AS privacy_scope,
    NULL::uuid AS author_id
FROM relationship_actions ra
WHERE ra.created_at >= now() - interval '365 days';

-- Indexes on materialized view (populated, so safe to create)
CREATE UNIQUE INDEX idx_story_cache_id ON public.story_events_cache (id);
CREATE INDEX idx_story_cache_opp ON public.story_events_cache (opportunity_id, occurred_at DESC);
CREATE INDEX idx_story_cache_kind ON public.story_events_cache (kind);

-- Re-create the regular view wrapper
CREATE OR REPLACE VIEW public.story_events_view AS
SELECT * FROM public.story_events_cache;

-- Refresh function (uses CONCURRENTLY since view is now populated)
CREATE OR REPLACE FUNCTION public.refresh_story_events_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.story_events_cache;
END;
$$;

-- ─── PART 3: LOCAL PULSE SELF-HEALING ───────────────────

ALTER TABLE public.local_pulse_sources
  ADD COLUMN IF NOT EXISTS retry_after timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.pulse_source_set_retry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.auto_disabled = true AND (OLD.auto_disabled IS DISTINCT FROM true) THEN
    NEW.retry_after := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pulse_source_retry ON public.local_pulse_sources;
CREATE TRIGGER trg_pulse_source_retry
  BEFORE UPDATE ON public.local_pulse_sources
  FOR EACH ROW EXECUTE FUNCTION public.pulse_source_set_retry();

-- ─── PART 5: HEALTH SUMMARY VIEWS ──────────────────────

CREATE OR REPLACE VIEW public.automation_health_summary AS
SELECT
  count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS runs_24h,
  count(*) FILTER (WHERE status = 'error' AND created_at > now() - interval '24 hours')::int AS failed_24h,
  count(*) FILTER (WHERE status = 'rate_limited' AND created_at > now() - interval '24 hours')::int AS rate_limited_24h,
  count(*) FILTER (WHERE status IN ('deduped','skipped_due_to_cap') AND created_at > now() - interval '24 hours')::int AS skipped_24h,
  count(*) FILTER (WHERE status = 'processed' AND created_at > now() - interval '24 hours')::int AS processed_24h,
  count(*) FILTER (WHERE status IN ('running','dispatched') AND created_at < now() - interval '10 minutes')::int AS stuck_runs
FROM automation_runs;

CREATE OR REPLACE VIEW public.pulse_health_summary AS
SELECT
  count(*)::int AS total_sources,
  count(*) FILTER (WHERE auto_disabled = false AND enabled = true)::int AS active_sources,
  count(*) FILTER (WHERE auto_disabled = true)::int AS disabled_sources,
  count(*) FILTER (WHERE auto_disabled = true AND retry_after IS NOT NULL AND retry_after < now())::int AS retrying_sources,
  max(last_checked_at) AS last_crawl_at
FROM local_pulse_sources;

CREATE OR REPLACE VIEW public.narrative_health_summary AS
SELECT
  count(*)::int AS total_metros_with_narratives,
  count(*) FILTER (WHERE updated_at > now() - interval '7 days')::int AS rebuilt_this_week,
  count(*) FILTER (WHERE narrative_cache_hash IS NOT NULL)::int AS cached_metros
FROM metro_narratives;

-- System health RPC
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN jsonb_build_object(
    'automation', (SELECT row_to_json(a) FROM automation_health_summary a),
    'pulse', (SELECT row_to_json(p) FROM pulse_health_summary p),
    'narrative', (SELECT row_to_json(n) FROM narrative_health_summary n),
    'drift', jsonb_build_object(
      'total_scores', (SELECT count(*)::int FROM metro_drift_scores),
      'scored_this_week', (SELECT count(*)::int FROM metro_drift_scores WHERE computed_at > now() - interval '7 days'),
      'avg_drift', (SELECT ROUND(avg(drift_score)::numeric, 1) FROM metro_drift_scores WHERE computed_at > now() - interval '7 days')
    )
  );
END;
$$;
