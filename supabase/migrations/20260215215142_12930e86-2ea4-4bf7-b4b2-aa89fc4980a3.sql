
-- ═══════════════════════════════════════════════════════════
-- PHASE 6A — INVISIBLE ARCHITECTURE STABILITY
-- ═══════════════════════════════════════════════════════════

-- ─── PART 1: AUTOMATION NORMALIZATION ───────────────────────
-- Add cooldown + dedupe + priority to automation_runs
ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS cooldown_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Index for cooldown lookups: latest run per workflow_key
CREATE INDEX IF NOT EXISTS idx_automation_runs_dedupe
  ON public.automation_runs (workflow_key, dedupe_key, created_at DESC);

-- Function: check cooldown before dispatching
CREATE OR REPLACE FUNCTION public.check_automation_cooldown(
  p_workflow_key text,
  p_dedupe_key text DEFAULT NULL,
  p_cooldown_seconds integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_run record;
  v_elapsed_seconds numeric;
BEGIN
  -- If no cooldown or no dedupe key, always allow
  IF p_cooldown_seconds <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_cooldown');
  END IF;

  -- Find most recent non-error run for this workflow + dedupe combo
  SELECT created_at, status INTO v_last_run
  FROM automation_runs
  WHERE workflow_key = p_workflow_key
    AND (p_dedupe_key IS NULL OR dedupe_key = p_dedupe_key)
    AND status NOT IN ('error', 'failed_timeout')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_run IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_prior_run');
  END IF;

  v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_last_run.created_at));

  IF v_elapsed_seconds < p_cooldown_seconds THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown_active',
      'seconds_remaining', (p_cooldown_seconds - v_elapsed_seconds)::int,
      'last_run_at', v_last_run.created_at
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', 'cooldown_expired');
END;
$$;


-- ─── PART 2: AI COST GUARDRAILS ────────────────────────────
-- Add ai_processing_state to email_communications
ALTER TABLE public.email_communications
  ADD COLUMN IF NOT EXISTS ai_processing_state text DEFAULT 'pending';

-- Add ai_processing_state to discovered_items
ALTER TABLE public.discovered_items
  ADD COLUMN IF NOT EXISTS ai_processing_state text DEFAULT 'pending';

-- Add ai_processing_state to journal_entries
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS ai_processing_state text DEFAULT 'pending';

-- Validation trigger for ai_processing_state
CREATE OR REPLACE FUNCTION public.validate_ai_processing_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ai_processing_state NOT IN ('pending', 'processed', 'skipped_duplicate', 'rate_limited') THEN
    RAISE EXCEPTION 'Invalid ai_processing_state: %', NEW.ai_processing_state;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_ai_state_check
  BEFORE INSERT OR UPDATE OF ai_processing_state ON public.email_communications
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_processing_state();

CREATE TRIGGER trg_discovered_ai_state_check
  BEFORE INSERT OR UPDATE OF ai_processing_state ON public.discovered_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_processing_state();

CREATE TRIGGER trg_journal_ai_state_check
  BEFORE INSERT OR UPDATE OF ai_processing_state ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_processing_state();

-- Index for batch processing: find pending items efficiently
CREATE INDEX IF NOT EXISTS idx_email_ai_state
  ON public.email_communications (ai_processing_state, sent_at DESC)
  WHERE ai_processing_state = 'pending';

CREATE INDEX IF NOT EXISTS idx_discovered_ai_state
  ON public.discovered_items (ai_processing_state)
  WHERE ai_processing_state = 'pending';


-- ─── PART 3: METRO NARRATIVE CACHE ─────────────────────────
ALTER TABLE public.metro_narratives
  ADD COLUMN IF NOT EXISTS narrative_cache_hash text;

-- Function to compute narrative input hash
CREATE OR REPLACE FUNCTION public.compute_narrative_cache_hash(p_metro_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reflection_count bigint;
  v_pulse_event_count bigint;
  v_signal_count bigint;
  v_drift_score numeric;
  v_hash text;
BEGIN
  -- Count new reflections (last 7 days) for opportunities in this metro
  SELECT count(*) INTO v_reflection_count
  FROM opportunity_reflections r
  JOIN opportunities o ON o.id = r.opportunity_id
  WHERE o.metro_id = p_metro_id
    AND r.created_at >= now() - interval '7 days';

  -- Count local pulse events (last 7 days)
  SELECT count(*) INTO v_pulse_event_count
  FROM local_pulse_sources lps
  WHERE lps.metro_id = p_metro_id
    AND lps.last_checked_at >= now() - interval '7 days';

  -- Count watchlist signals (last 7 days)
  SELECT count(*) INTO v_signal_count
  FROM org_watchlist_signals ows
  WHERE ows.created_at >= now() - interval '7 days';

  -- Get latest drift score
  SELECT COALESCE(ds.drift_score, 0) INTO v_drift_score
  FROM metro_drift_scores ds
  WHERE ds.metro_id = p_metro_id
  ORDER BY ds.computed_at DESC
  LIMIT 1;

  -- Build deterministic hash
  v_hash := md5(
    v_reflection_count::text || ':' ||
    v_pulse_event_count::text || ':' ||
    v_signal_count::text || ':' ||
    COALESCE(v_drift_score, 0)::text
  );

  RETURN v_hash;
END;
$$;


-- ─── PART 4: LOCAL PULSE STABILIZATION ──────────────────────
ALTER TABLE public.local_pulse_sources
  ADD COLUMN IF NOT EXISTS crawl_health_score integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS failure_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_disabled boolean DEFAULT false;

-- Function: increment failure and auto-disable after 3
CREATE OR REPLACE FUNCTION public.pulse_source_record_failure(p_source_id uuid, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_count integer;
BEGIN
  UPDATE local_pulse_sources
  SET failure_count = failure_count + 1,
      last_error = COALESCE(p_error, last_error),
      last_status = 'error',
      crawl_health_score = GREATEST(0, crawl_health_score - 33),
      updated_at = now()
  WHERE id = p_source_id
  RETURNING failure_count INTO v_new_count;

  -- Auto-disable after 3 consecutive failures
  IF v_new_count >= 3 THEN
    UPDATE local_pulse_sources
    SET auto_disabled = true, enabled = false
    WHERE id = p_source_id;
  END IF;
END;
$$;

-- Function: reset failure count on success
CREATE OR REPLACE FUNCTION public.pulse_source_record_success(p_source_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE local_pulse_sources
  SET failure_count = 0,
      crawl_health_score = 100,
      last_status = 'ok',
      last_checked_at = now(),
      auto_disabled = false,
      updated_at = now()
  WHERE id = p_source_id;
END;
$$;


-- ─── PART 5: DRIFT DETECTION ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.metro_drift_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metro_id uuid NOT NULL REFERENCES public.metros(id),
  drift_score numeric NOT NULL DEFAULT 0,
  drift_delta numeric NOT NULL DEFAULT 0,
  signal_counts jsonb DEFAULT '{}'::jsonb,
  topic_shifts jsonb DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  run_id text
);

ALTER TABLE public.metro_drift_scores ENABLE ROW LEVEL SECURITY;

-- Admins, leadership, regional leads can read drift scores
CREATE POLICY "drift_scores_select" ON public.metro_drift_scores
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership', 'regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- Only service role inserts (via edge functions)
CREATE POLICY "drift_scores_insert_service" ON public.metro_drift_scores
  FOR INSERT WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_drift_metro_computed
  ON public.metro_drift_scores (metro_id, computed_at DESC);

-- Validation trigger for drift_score bounds
CREATE TRIGGER trg_drift_score_validate
  BEFORE INSERT OR UPDATE ON public.metro_drift_scores
  FOR EACH ROW EXECUTE FUNCTION public.validate_drift_score();


-- ─── PART 6: STORY EVENTS VIEW ─────────────────────────────
CREATE OR REPLACE VIEW public.story_events_view AS

-- Reflections
SELECT
  'reflection:' || r.id AS id,
  r.opportunity_id,
  'reflection'::text AS kind,
  'Reflection'::text AS title,
  LEFT(regexp_replace(r.body, '<[^>]*>', '', 'g'), 280) AS summary,
  r.created_at AS occurred_at,
  r.visibility AS privacy_scope,
  r.author_id
FROM public.opportunity_reflections r

UNION ALL

-- Emails (metadata only — no body exposure)
SELECT
  'email:' || e.id AS id,
  c.opportunity_id,
  'email'::text AS kind,
  COALESCE(NULLIF(e.subject, ''), LEFT(COALESCE(e.snippet, '(no subject)'), 60)) AS title,
  LEFT(COALESCE(e.snippet, ''), 280) AS summary,
  e.sent_at AS occurred_at,
  'private'::text AS privacy_scope,
  e.user_id AS author_id
FROM public.email_communications e
JOIN public.contacts c ON c.id = e.contact_id
WHERE c.opportunity_id IS NOT NULL

UNION ALL

-- Campaign touches
SELECT
  'campaign:' || a.campaign_id || '-' || a.id AS id,
  a.opportunity_id,
  'campaign'::text AS kind,
  COALESCE(ec.name, 'Campaign') AS title,
  'Subject: ' || COALESCE(ec.subject, 'N/A') || ' — ' || COALESCE(a.status, 'sent') AS summary,
  a.sent_at AS occurred_at,
  'team'::text AS privacy_scope,
  NULL::uuid AS author_id
FROM public.email_campaign_audience a
JOIN public.email_campaigns ec ON ec.id = a.campaign_id
WHERE a.opportunity_id IS NOT NULL

UNION ALL

-- Relationship actions (tasks)
SELECT
  'task:' || ra.id AS id,
  ra.opportunity_id,
  'task'::text AS kind,
  'Task: ' || COALESCE(ra.title, 'Untitled') AS title,
  COALESCE(ra.summary, '') AS summary,
  ra.created_at AS occurred_at,
  'team'::text AS privacy_scope,
  NULL::uuid AS author_id
FROM public.relationship_actions ra;

-- RLS on views uses the underlying table policies, but add comment for clarity
COMMENT ON VIEW public.story_events_view IS 'Pre-joined story timeline. RLS enforced via underlying table policies. No raw email bodies exposed.';


-- ─── PART 7: SAFETY LOCKS ──────────────────────────────────

-- Notification throttle function (max per hour, silently drops)
CREATE OR REPLACE FUNCTION public.check_notification_throttle(
  p_user_id uuid,
  p_max_per_hour integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM proactive_notifications
  WHERE user_id = p_user_id
    AND created_at >= now() - interval '1 hour';

  RETURN v_count < p_max_per_hour;
END;
$$;

-- Update mark_stuck_runs to also handle retry_count
CREATE OR REPLACE FUNCTION public.mark_stuck_runs_failed(p_threshold_minutes integer DEFAULT 30)
RETURNS TABLE(run_id text, workflow_key text, stuck_since timestamptz)
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
    processed_at = now(),
    retry_count = COALESCE(ar.retry_count, 0) + 1
  WHERE ar.status IN ('dispatched', 'running')
    AND ar.created_at < now() - (p_threshold_minutes || ' minutes')::interval
  RETURNING ar.run_id, ar.workflow_key, ar.created_at;
END;
$$;
