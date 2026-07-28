-- ============================================================
-- Migration: Fix Security Definer Views → Security Invoker
-- Also: Move 3 materialized views out of public API
-- Also: Lock down archetype_interest_signals insert
-- ============================================================

-- 1. Recreate all 8 Security Definer views as Security Invoker
-- (DROP + CREATE with same definition but explicit SECURITY INVOKER)

-- 1a. automation_health_summary
DROP VIEW IF EXISTS public.automation_health_summary;
CREATE VIEW public.automation_health_summary
WITH (security_invoker = true)
AS
SELECT
  count(*) FILTER (WHERE created_at > (now() - '24:00:00'::interval))::integer AS runs_24h,
  count(*) FILTER (WHERE status = 'error' AND created_at > (now() - '24:00:00'::interval))::integer AS failed_24h,
  count(*) FILTER (WHERE status = 'rate_limited' AND created_at > (now() - '24:00:00'::interval))::integer AS rate_limited_24h,
  count(*) FILTER (WHERE status = ANY(ARRAY['deduped','skipped_due_to_cap']) AND created_at > (now() - '24:00:00'::interval))::integer AS skipped_24h,
  count(*) FILTER (WHERE status = 'processed' AND created_at > (now() - '24:00:00'::interval))::integer AS processed_24h,
  count(*) FILTER (WHERE status = ANY(ARRAY['running','dispatched']) AND created_at < (now() - '00:10:00'::interval))::integer AS stuck_runs
FROM automation_runs;

-- 1b. narrative_health_summary
DROP VIEW IF EXISTS public.narrative_health_summary;
CREATE VIEW public.narrative_health_summary
WITH (security_invoker = true)
AS
SELECT
  count(*)::integer AS total_metros_with_narratives,
  count(*) FILTER (WHERE updated_at > (now() - '7 days'::interval))::integer AS rebuilt_this_week,
  count(*) FILTER (WHERE narrative_cache_hash IS NOT NULL)::integer AS cached_metros
FROM metro_narratives;

-- 1c. pulse_health_summary
DROP VIEW IF EXISTS public.pulse_health_summary;
CREATE VIEW public.pulse_health_summary
WITH (security_invoker = true)
AS
SELECT
  count(DISTINCT metro_id)::integer AS total_metros_with_sources,
  count(*)::integer AS total_sources,
  count(*) FILTER (WHERE last_checked_at > (now() - '7 days'::interval))::integer AS checked_this_week
FROM local_pulse_sources;

-- 1d. operator_vigilia_summary
DROP VIEW IF EXISTS public.operator_vigilia_summary;
CREATE VIEW public.operator_vigilia_summary
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  type AS signal_type,
  count(*) FILTER (WHERE created_at >= (now() - '7 days'::interval))::integer AS count_last_7d,
  count(*) FILTER (WHERE created_at >= (now() - '30 days'::interval))::integer AS count_last_30d,
  CASE
    WHEN count(*) FILTER (WHERE created_at >= (now() - '7 days'::interval))::numeric > (count(*) FILTER (WHERE created_at >= (now() - '30 days'::interval))::numeric * 0.5) THEN 'rising'
    WHEN count(*) FILTER (WHERE created_at >= (now() - '7 days'::interval))::numeric < (count(*) FILTER (WHERE created_at >= (now() - '30 days'::interval))::numeric * 0.2) THEN 'falling'
    ELSE 'stable'
  END AS trend_direction
FROM vigilia_signals
WHERE status <> 'archived'
GROUP BY tenant_id, type;

-- 1e. org_action_history_v
DROP VIEW IF EXISTS public.org_action_history_v;
CREATE VIEW public.org_action_history_v
WITH (security_invoker = true)
AS
SELECT
  a.org_id,
  a.id AS action_id,
  a.action_type,
  a.source,
  a.hypothesis AS action_summary,
  a.status AS action_status,
  a.created_at AS action_created_at,
  a.executed_at,
  o.outcome_type,
  o.observed_at,
  o.confidence AS outcome_confidence
FROM org_actions a
LEFT JOIN org_campaign_outcomes o ON o.action_id = a.id
ORDER BY a.created_at DESC;

-- 1f. org_insight_effectiveness_v
DROP VIEW IF EXISTS public.org_insight_effectiveness_v;
CREATE VIEW public.org_insight_effectiveness_v
WITH (security_invoker = true)
AS
SELECT
  i.id AS insight_id,
  i.org_id,
  i.insight_type,
  count(DISTINCT a.id) AS actions_created,
  count(DISTINCT a.id) FILTER (WHERE a.status = 'completed') AS actions_completed,
  count(DISTINCT o.id) FILTER (WHERE o.outcome_type = 'successful') AS actions_successful,
  count(DISTINCT o.id) FILTER (WHERE o.outcome_type = 'unsuccessful') AS actions_unsuccessful,
  CASE
    WHEN count(DISTINCT o.id) FILTER (WHERE o.outcome_type = ANY(ARRAY['successful','unsuccessful'])) = 0 THEN NULL::numeric
    ELSE round(count(DISTINCT o.id) FILTER (WHERE o.outcome_type = 'successful')::numeric / NULLIF(count(DISTINCT o.id) FILTER (WHERE o.outcome_type = ANY(ARRAY['successful','unsuccessful'])), 0)::numeric * 100, 1)
  END AS success_rate
FROM org_insights i
LEFT JOIN org_recommended_actions a ON a.insight_id = i.id
LEFT JOIN org_action_outcomes o ON o.action_id = a.id
GROUP BY i.id, i.org_id, i.insight_type;

-- 1g. org_knowledge_current_v
DROP VIEW IF EXISTS public.org_knowledge_current_v;
CREATE VIEW public.org_knowledge_current_v
WITH (security_invoker = true)
AS
SELECT
  org_id,
  id AS snapshot_id,
  version,
  structured_json,
  raw_excerpt,
  source_type,
  source_url,
  created_by,
  created_at,
  updated_at
FROM org_knowledge_snapshots s
WHERE version = (SELECT max(version) FROM org_knowledge_snapshots s2 WHERE s2.org_id = s.org_id);

-- 1h. email_do_not_email
DROP VIEW IF EXISTS public.email_do_not_email;
CREATE VIEW public.email_do_not_email
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  lower(email) AS email,
  max(created_at) AS suppressed_at
FROM email_suppressions
GROUP BY tenant_id, lower(email);

-- ============================================================
-- 2. Revoke direct API access to materialized views
-- ============================================================
REVOKE SELECT ON public.metro_momentum_signals FROM anon, authenticated;
REVOKE SELECT ON public.org_action_effectiveness_mv FROM anon, authenticated;
REVOKE SELECT ON public.story_events_cache FROM anon, authenticated;

-- Grant back to authenticated only (they're used by DB functions with SECURITY DEFINER)
GRANT SELECT ON public.metro_momentum_signals TO authenticated;

-- ============================================================
-- 3. Lock down archetype_interest_signals — require at least anon key
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert interest signals" ON public.archetype_interest_signals;
CREATE POLICY "Authenticated users can insert interest signals"
  ON public.archetype_interest_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
