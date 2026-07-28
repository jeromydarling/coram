
-- ============================================================
-- P0-1: Fix notification tables — restrict ALL policies to service_role only
-- (Currently on PUBLIC role with USING(true), allowing any authenticated user to write/delete)
-- ============================================================

-- notification_events: drop permissive ALL policy, recreate for service_role only
DROP POLICY IF EXISTS "Service role manages notification events" ON public.notification_events;
CREATE POLICY "Service role manages notification events"
  ON public.notification_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- notification_deliveries: same fix
DROP POLICY IF EXISTS "Service role manages notification deliveries" ON public.notification_deliveries;
CREATE POLICY "Service role manages notification deliveries"
  ON public.notification_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- notification_queue: same fix
DROP POLICY IF EXISTS "Service role manages notification queue" ON public.notification_queue;
CREATE POLICY "Service role manages notification queue"
  ON public.notification_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- P0-2: Add policies for enrichment_jobs and enrichment_results
-- (RLS enabled but 0 policies = completely locked)
-- ============================================================

-- enrichment_jobs: service_role full access, authenticated users can read their metro's jobs
CREATE POLICY "Service role manages enrichment jobs"
  ON public.enrichment_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view enrichment jobs for accessible opportunities"
  ON public.enrichment_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = enrichment_jobs.entity_id
        AND has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- enrichment_results: service_role full access, authenticated users can read
CREATE POLICY "Service role manages enrichment results"
  ON public.enrichment_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view enrichment results for accessible opportunities"
  ON public.enrichment_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrichment_jobs ej
      JOIN opportunities o ON o.id = ej.entity_id
      WHERE ej.run_id = enrichment_results.run_id
        AND has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ============================================================
-- P1-4: Add regional_lead to narrative_partner_suggestions RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can view partner suggestions for assigned metros" ON public.narrative_partner_suggestions;
CREATE POLICY "Users can view partner suggestions for assigned metros"
  ON public.narrative_partner_suggestions
  FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'regional_lead'::app_role])
    OR has_metro_access(auth.uid(), metro_id)
  );

DROP POLICY IF EXISTS "Users can dismiss partner suggestions for assigned metros" ON public.narrative_partner_suggestions;
CREATE POLICY "Users can dismiss partner suggestions for assigned metros"
  ON public.narrative_partner_suggestions
  FOR UPDATE
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'regional_lead'::app_role])
    OR has_metro_access(auth.uid(), metro_id)
  );

-- ============================================================
-- P1-5: Recreate SECURITY DEFINER views as SECURITY INVOKER
-- (org_knowledge_current_v and resend_candidates_v1 bypass caller RLS)
-- ============================================================

-- org_knowledge_current_v
DROP VIEW IF EXISTS public.org_knowledge_current_v;
CREATE VIEW public.org_knowledge_current_v
WITH (security_invoker = on) AS
  SELECT org_id,
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
  WHERE active = true AND is_authoritative = true;

-- resend_candidates_v1
DROP VIEW IF EXISTS public.resend_candidates_v1;
CREATE VIEW public.resend_candidates_v1
WITH (security_invoker = on) AS
  SELECT id,
    campaign_id,
    email,
    name,
    contact_id,
    opportunity_id,
    failure_category,
    failure_code,
    error_message,
    created_at
  FROM email_campaign_audience eca
  WHERE status = 'failed'
    AND COALESCE(failure_category, 'unknown') = ANY (ARRAY['provider_temp', 'quota', 'unknown'])
    AND COALESCE(failure_category, '') <> ALL (ARRAY['invalid_address', 'bounce', 'provider_perm'])
    AND (sent_at IS NULL OR sent_at < now() - interval '24 hours');
