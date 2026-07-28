
-- Metro Expansion Plans table
CREATE TABLE public.metro_expansion_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  metro_id uuid NOT NULL REFERENCES public.metros(id),
  status text NOT NULL DEFAULT 'research' CHECK (status IN ('research','relationships','pilot','launching','active','paused')),
  owner_user_id uuid REFERENCES auth.users(id),
  notes text,
  priority int NOT NULL DEFAULT 0,
  target_launch_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_metro_expansion_plans_metro_status ON public.metro_expansion_plans (metro_id, status);
CREATE INDEX idx_metro_expansion_plans_tenant_priority ON public.metro_expansion_plans (tenant_id, priority);

ALTER TABLE public.metro_expansion_plans ENABLE ROW LEVEL SECURITY;

-- Helper: check if user belongs to a tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- Tenant users see their own plans; admins/leadership see all
CREATE POLICY "expansion_plans_select"
  ON public.metro_expansion_plans FOR SELECT
  USING (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    OR public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[])
  );

CREATE POLICY "expansion_plans_insert"
  ON public.metro_expansion_plans FOR INSERT
  WITH CHECK (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    OR public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[])
  );

CREATE POLICY "expansion_plans_update"
  ON public.metro_expansion_plans FOR UPDATE
  USING (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    OR public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[])
  );

CREATE POLICY "expansion_plans_delete"
  ON public.metro_expansion_plans FOR DELETE
  USING (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    OR public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[])
  );

-- Updated_at trigger
CREATE TRIGGER set_metro_expansion_plans_updated_at
  BEFORE UPDATE ON public.metro_expansion_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
