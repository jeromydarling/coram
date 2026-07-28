
-- =================================================================
-- CRITICAL RLS FIX: Add tenant-scoping to SELECT policies
-- These tables currently allow ANY authenticated user to see ALL rows
-- across ALL tenants. Adding is_tenant_member() check.
-- =================================================================

-- 1. CONTACTS: Replace overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view contacts" ON public.contacts;
CREATE POLICY "Users can view contacts"
  ON public.contacts
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_tenant_member(tenant_id, auth.uid())
  );

-- 2. OPPORTUNITIES: Replace overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view opportunities" ON public.opportunities;
CREATE POLICY "Users can view opportunities"
  ON public.opportunities
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_tenant_member(tenant_id, auth.uid())
  );

-- 3. EVENTS: Replace overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view events" ON public.events;
CREATE POLICY "Users can view events"
  ON public.events
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_tenant_member(tenant_id, auth.uid())
  );

-- 4. VOLUNTEERS: Replace overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view volunteers" ON public.volunteers;
CREATE POLICY "Users can view volunteers"
  ON public.volunteers
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_tenant_member(tenant_id, auth.uid())
  );

-- 5. GRANTS: No tenant_id column; scope via metro_id + role check
-- The existing "Users can view grants" policy only checks deleted_at IS NULL
-- Replace with proper access control
DROP POLICY IF EXISTS "Users can view grants" ON public.grants;
CREATE POLICY "Users can view grants"
  ON public.grants
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
      OR owner_id = auth.uid()
      OR has_metro_access(auth.uid(), metro_id)
    )
  );
