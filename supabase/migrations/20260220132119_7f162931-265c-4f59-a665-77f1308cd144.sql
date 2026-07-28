
-- ============================================================
-- Flocknote Bridge: people_groups + memberships + connector row
-- ============================================================

-- 1) People Groups table
CREATE TABLE IF NOT EXISTS public.people_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  source_connector TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, group_name)
);

ALTER TABLE public.people_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their groups"
  ON public.people_groups FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage groups"
  ON public.people_groups FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) People Group Memberships join table
CREATE TABLE IF NOT EXISTS public.people_group_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.people_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

ALTER TABLE public.people_group_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view memberships"
  ON public.people_group_memberships FOR SELECT
  USING (group_id IN (
    SELECT pg.id FROM public.people_groups pg
    WHERE pg.tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage memberships"
  ON public.people_group_memberships FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Insert Flocknote connector into relatio_connectors
INSERT INTO public.relatio_connectors (key, name, mode, description, active, category, direction)
VALUES (
  'flocknote',
  'Flocknote',
  'one_way',
  'CSV-based import of people, groups, and memberships from Flocknote.',
  true,
  'crm',
  'one_way_in'
) ON CONFLICT (key) DO NOTHING;

-- 4) Trigger for updated_at on people_groups
CREATE TRIGGER set_people_groups_updated_at
  BEFORE UPDATE ON public.people_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
