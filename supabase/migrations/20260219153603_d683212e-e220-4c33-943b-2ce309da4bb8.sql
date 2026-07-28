
-- Communio: Opt-in shared narrative network tables

-- Groups (collaborative circles between tenants)
CREATE TABLE public.communio_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by_tenant uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_communio_groups_created_by ON public.communio_groups(created_by_tenant);

ALTER TABLE public.communio_groups ENABLE ROW LEVEL SECURITY;

-- Memberships (which tenants belong to which groups)
CREATE TABLE public.communio_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  sharing_level text NOT NULL DEFAULT 'none'
    CHECK (sharing_level IN ('none', 'signals', 'reflections', 'collaboration')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, group_id)
);

CREATE INDEX idx_communio_memberships_group ON public.communio_memberships(group_id);
CREATE INDEX idx_communio_memberships_tenant ON public.communio_memberships(tenant_id);

ALTER TABLE public.communio_memberships ENABLE ROW LEVEL SECURITY;

-- Shared signals (sanitized NRI narrative signals shared to groups)
CREATE TABLE public.communio_shared_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metro_id uuid REFERENCES public.metros(id),
  signal_type text NOT NULL,
  signal_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_communio_signals_group ON public.communio_shared_signals(group_id);
CREATE INDEX idx_communio_signals_created ON public.communio_shared_signals(created_at DESC);

ALTER TABLE public.communio_shared_signals ENABLE ROW LEVEL SECURITY;

-- Shared events (opt-in event collaboration between tenants)
CREATE TABLE public.communio_shared_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'group',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, event_id)
);

CREATE INDEX idx_communio_events_group ON public.communio_shared_events(group_id);

ALTER TABLE public.communio_shared_events ENABLE ROW LEVEL SECURITY;

-- Helper: check if user's tenant is a member of a given group
CREATE OR REPLACE FUNCTION public.tenant_is_communio_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.communio_memberships cm
    JOIN public.tenant_users tu ON tu.tenant_id = cm.tenant_id
    WHERE tu.user_id = _user_id
      AND cm.group_id = _group_id
  );
$$;

-- Helper: get user's tenant id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = _user_id LIMIT 1;
$$;

-- Helper: get sharing level for user's tenant in a group
CREATE OR REPLACE FUNCTION public.get_communio_sharing_level(_user_id uuid, _group_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.sharing_level
  FROM public.communio_memberships cm
  JOIN public.tenant_users tu ON tu.tenant_id = cm.tenant_id
  WHERE tu.user_id = _user_id
    AND cm.group_id = _group_id
  LIMIT 1;
$$;

-- RLS: communio_groups — visible only to member tenants
CREATE POLICY "Members can view groups"
  ON public.communio_groups FOR SELECT TO authenticated
  USING (public.tenant_is_communio_member(auth.uid(), id));

CREATE POLICY "Tenant admins can create groups"
  ON public.communio_groups FOR INSERT TO authenticated
  WITH CHECK (
    created_by_tenant = public.get_user_tenant_id(auth.uid())
  );

-- RLS: communio_memberships — tenant-scoped CRUD
CREATE POLICY "Members can view memberships in their groups"
  ON public.communio_memberships FOR SELECT TO authenticated
  USING (public.tenant_is_communio_member(auth.uid(), group_id));

CREATE POLICY "Tenant can manage own memberships"
  ON public.communio_memberships FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant can remove own memberships"
  ON public.communio_memberships FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant can update own sharing level"
  ON public.communio_memberships FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- RLS: communio_shared_signals — visible to group members with signals+ sharing
CREATE POLICY "Members with signals access can view shared signals"
  ON public.communio_shared_signals FOR SELECT TO authenticated
  USING (
    public.tenant_is_communio_member(auth.uid(), group_id)
    AND public.get_communio_sharing_level(auth.uid(), group_id) IN ('signals', 'reflections', 'collaboration')
  );

CREATE POLICY "Tenant can share own signals"
  ON public.communio_shared_signals FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- RLS: communio_shared_events — visible to group members with collaboration sharing
CREATE POLICY "Members with collaboration access can view shared events"
  ON public.communio_shared_events FOR SELECT TO authenticated
  USING (
    public.tenant_is_communio_member(auth.uid(), group_id)
    AND public.get_communio_sharing_level(auth.uid(), group_id) = 'collaboration'
  );

CREATE POLICY "Tenant can share own events"
  ON public.communio_shared_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
