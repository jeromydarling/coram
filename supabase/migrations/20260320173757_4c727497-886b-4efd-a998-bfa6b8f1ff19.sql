-- Demo tenant public read access
CREATE OR REPLACE FUNCTION public.is_demo_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demo_tenants
    WHERE tenant_id = p_tenant_id AND is_demo = true
  )
$$;

CREATE POLICY "demo_anon_contacts" ON public.contacts FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_opportunities" ON public.opportunities FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_activities" ON public.activities FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_events" ON public.events FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_volunteers" ON public.volunteers FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_event_regs" ON public.event_registrations FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_tenants" ON public.tenants FOR SELECT TO anon USING (public.is_demo_tenant(id));
CREATE POLICY "demo_anon_feature_flags" ON public.tenant_feature_flags FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_discovered" ON public.discovered_items FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));