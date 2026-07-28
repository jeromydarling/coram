-- Critical tenant isolation fix: prevent cross-tenant reads via overly broad ALL policies
-- on tenant-scoped operational tables.

-- Activities
DROP POLICY IF EXISTS "Users can manage activities in assigned metros" ON public.activities;
CREATE POLICY "Users can manage activities in assigned metros"
ON public.activities
FOR ALL
TO authenticated
USING (
  is_tenant_member(tenant_id, auth.uid())
  AND (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR has_metro_access(auth.uid(), metro_id)
  )
)
WITH CHECK (
  is_tenant_member(tenant_id, auth.uid())
  AND (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR has_metro_access(auth.uid(), metro_id)
  )
);

-- Events
DROP POLICY IF EXISTS "Users can manage events in assigned metros" ON public.events;
CREATE POLICY "Users can manage events in assigned metros"
ON public.events
FOR ALL
TO authenticated
USING (
  is_tenant_member(tenant_id, auth.uid())
  AND (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR has_metro_access(auth.uid(), metro_id)
  )
)
WITH CHECK (
  is_tenant_member(tenant_id, auth.uid())
  AND (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR has_metro_access(auth.uid(), metro_id)
  )
);