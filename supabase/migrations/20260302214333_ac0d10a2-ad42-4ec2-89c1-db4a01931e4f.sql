
-- ============================================================
-- Tighten permissive INSERT/UPDATE policies on tenant-scoped tables
-- These policies currently allow ANY authenticated user to write,
-- but should require tenant membership or service-role only.
-- ============================================================

-- 1. follow_up_suggestions: Change from public INSERT to service-role only
--    This table is populated by edge functions, not directly by users.
DROP POLICY IF EXISTS "Authenticated users can insert follow-up suggestions" ON public.follow_up_suggestions;
CREATE POLICY "Service role inserts follow-up suggestions"
  ON public.follow_up_suggestions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2. communio_activity_log: Require tenant membership for INSERT
DROP POLICY IF EXISTS "Authenticated insert communio_activity_log" ON public.communio_activity_log;
CREATE POLICY "Tenant members can insert communio_activity_log"
  ON public.communio_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (is_tenant_member(tenant_id, auth.uid()));

-- 3. testimonium_events: Require tenant membership for INSERT
DROP POLICY IF EXISTS "testimonium_events_insert" ON public.testimonium_events;
CREATE POLICY "Tenant members can insert testimonium_events"
  ON public.testimonium_events
  FOR INSERT
  TO authenticated
  WITH CHECK (is_tenant_member(tenant_id, auth.uid()));

-- 4. vigilia_signals: Change from public INSERT to service-role only
--    Populated by edge functions only.
DROP POLICY IF EXISTS "vigilia_signals_service_insert" ON public.vigilia_signals;
CREATE POLICY "Service role inserts vigilia signals"
  ON public.vigilia_signals
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 5. relatio_object_map: Require tenant membership for INSERT and UPDATE
DROP POLICY IF EXISTS "rom_insert" ON public.relatio_object_map;
CREATE POLICY "Tenant members can insert relatio_object_map"
  ON public.relatio_object_map
  FOR INSERT
  TO authenticated
  WITH CHECK (is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "rom_update" ON public.relatio_object_map;
CREATE POLICY "Tenant members can update relatio_object_map"
  ON public.relatio_object_map
  FOR UPDATE
  TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));

-- 6. org_neighborhood_insight_sources: Restrict to service-role
--    Populated by edge functions during enrichment.
DROP POLICY IF EXISTS "Authenticated users can insert insight sources" ON public.org_neighborhood_insight_sources;
CREATE POLICY "Service role inserts insight sources"
  ON public.org_neighborhood_insight_sources
  FOR INSERT
  TO service_role
  WITH CHECK (true);
