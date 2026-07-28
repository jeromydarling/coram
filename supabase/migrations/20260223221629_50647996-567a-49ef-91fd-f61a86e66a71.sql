-- ============================================================
-- Tighten soft-delete RLS policies on core tables
-- Replace USING(true) with proper tenant_id scoping via has_any_role
-- ============================================================

-- contacts: tenant_id scoped soft-delete
DROP POLICY IF EXISTS "Users can soft-delete contacts" ON public.contacts;
CREATE POLICY "Users can soft-delete contacts"
  ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- events: tenant_id scoped soft-delete
DROP POLICY IF EXISTS "Users can soft-delete events" ON public.events;
CREATE POLICY "Users can soft-delete events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- opportunities: tenant_id scoped soft-delete
DROP POLICY IF EXISTS "Users can soft-delete opportunities" ON public.opportunities;
CREATE POLICY "Users can soft-delete opportunities"
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- volunteers: tenant_id scoped soft-delete
DROP POLICY IF EXISTS "Users can soft-delete volunteers" ON public.volunteers;
CREATE POLICY "Users can soft-delete volunteers"
  ON public.volunteers
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- grants: no tenant_id column — scope by metro access
DROP POLICY IF EXISTS "Users can soft-delete grants" ON public.grants;
CREATE POLICY "Users can soft-delete grants"
  ON public.grants
  FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- metros: scope by metro access (admin/leadership/region assignment)
DROP POLICY IF EXISTS "Users can soft-delete metros" ON public.metros;
CREATE POLICY "Users can soft-delete metros"
  ON public.metros
  FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), id)
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), id)
  );
