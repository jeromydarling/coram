
-- Fix cross-tenant data leak: metro-access policies on tenant-scoped tables
-- must also verify tenant membership to prevent users from seeing other tenants' data.

-- 1. opportunities: drop the leaky policy, recreate with tenant check
DROP POLICY IF EXISTS "Users can view opportunities in assigned metros" ON public.opportunities;
CREATE POLICY "Users can view opportunities in assigned metros"
  ON public.opportunities FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND is_tenant_member(tenant_id, auth.uid())
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
      OR has_metro_access(auth.uid(), metro_id)
    )
  );

-- 2. activities
DROP POLICY IF EXISTS "Users can view activities in assigned metros" ON public.activities;
CREATE POLICY "Users can view activities in assigned metros"
  ON public.activities FOR SELECT TO authenticated
  USING (
    is_tenant_member(tenant_id, auth.uid())
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
      OR has_metro_access(auth.uid(), metro_id)
    )
  );

-- 3. events
DROP POLICY IF EXISTS "Users can view events in assigned metros" ON public.events;
CREATE POLICY "Users can view events in assigned metros"
  ON public.events FOR SELECT TO authenticated
  USING (
    is_tenant_member(tenant_id, auth.uid())
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
      OR has_metro_access(auth.uid(), metro_id)
    )
  );

-- 4. discovered_items
DROP POLICY IF EXISTS "Users read discovered_items via links" ON public.discovered_items;
CREATE POLICY "Users read discovered_items via links"
  ON public.discovered_items FOR SELECT TO authenticated
  USING (
    is_tenant_member(tenant_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM discovery_item_links dil
      WHERE dil.discovered_item_id = discovered_items.id
        AND (
          (dil.metro_id IS NOT NULL AND has_metro_access(auth.uid(), dil.metro_id))
          OR (dil.opportunity_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM opportunities o WHERE o.id = dil.opportunity_id AND has_metro_access(auth.uid(), o.metro_id)
          ))
        )
    )
  );

-- 5. discovery_briefings
DROP POLICY IF EXISTS "Users read discovery_briefings for their metros" ON public.discovery_briefings;
CREATE POLICY "Users read discovery_briefings for their metros"
  ON public.discovery_briefings FOR SELECT TO authenticated
  USING (
    is_tenant_member(tenant_id, auth.uid())
    AND (
      (metro_id IS NOT NULL AND has_metro_access(auth.uid(), metro_id))
      OR (opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM opportunities o WHERE o.id = discovery_briefings.opportunity_id AND has_metro_access(auth.uid(), o.metro_id)
      ))
    )
  );

-- 6. discovery_runs
DROP POLICY IF EXISTS "Users read discovery_runs for their metros" ON public.discovery_runs;
CREATE POLICY "Users read discovery_runs for their metros"
  ON public.discovery_runs FOR SELECT TO authenticated
  USING (
    is_tenant_member(tenant_id, auth.uid())
    AND (
      (metro_id IS NOT NULL AND has_metro_access(auth.uid(), metro_id))
      OR (opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM opportunities o WHERE o.id = discovery_runs.opportunity_id AND has_metro_access(auth.uid(), o.metro_id)
      ))
    )
  );
