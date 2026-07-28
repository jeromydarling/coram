
-- ══════════════════════════════════════════════════════════
-- Phase 7U: Communio Expansion
-- ══════════════════════════════════════════════════════════

-- 1) communio_group_settings
CREATE TABLE public.communio_group_settings (
  group_id uuid PRIMARY KEY REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'invite_only' CHECK (visibility IN ('invite_only','open_discovery')),
  allow_event_sharing boolean NOT NULL DEFAULT true,
  allow_signal_sharing boolean NOT NULL DEFAULT true,
  allow_reflection_sharing boolean NOT NULL DEFAULT false,
  allow_story_heatmap boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communio_group_settings ENABLE ROW LEVEL SECURITY;

-- Members can read settings of groups they belong to
CREATE POLICY "Members can view group settings"
  ON public.communio_group_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communio_memberships cm
      JOIN public.tenant_users tu ON tu.tenant_id = cm.tenant_id
      WHERE cm.group_id = communio_group_settings.group_id
        AND tu.user_id = auth.uid()
    )
  );

-- Group creator (admin) can update settings
CREATE POLICY "Group creator can update settings"
  ON public.communio_group_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communio_groups cg
      JOIN public.tenant_users tu ON tu.tenant_id = cg.created_by_tenant
      WHERE cg.id = communio_group_settings.group_id
        AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admins can insert settings
CREATE POLICY "Admins can insert group settings"
  ON public.communio_group_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communio_groups cg
      JOIN public.tenant_users tu ON tu.tenant_id = cg.created_by_tenant
      WHERE cg.id = communio_group_settings.group_id
        AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2) communio_signal_metrics
CREATE TABLE public.communio_signal_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  momentum_count int NOT NULL DEFAULT 0,
  drift_count int NOT NULL DEFAULT 0,
  reconnection_count int NOT NULL DEFAULT 0,
  growth_count int NOT NULL DEFAULT 0,
  shared_event_count int NOT NULL DEFAULT 0,
  tenant_count int NOT NULL DEFAULT 0,
  UNIQUE(group_id, week_start)
);

ALTER TABLE public.communio_signal_metrics ENABLE ROW LEVEL SECURITY;

-- Group members can read metrics
CREATE POLICY "Members can view signal metrics"
  ON public.communio_signal_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communio_memberships cm
      JOIN public.tenant_users tu ON tu.tenant_id = cm.tenant_id
      WHERE cm.group_id = communio_signal_metrics.group_id
        AND tu.user_id = auth.uid()
    )
  );

-- 3) communio_invites
CREATE TABLE public.communio_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  invited_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communio_invites ENABLE ROW LEVEL SECURITY;

-- Group members can see invites for their groups
CREATE POLICY "Members can view group invites"
  ON public.communio_invites FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communio_memberships cm
      JOIN public.tenant_users tu ON tu.tenant_id = cm.tenant_id
      WHERE cm.group_id = communio_invites.group_id
        AND tu.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = communio_invites.invited_tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Group creator/admin can create invites
CREATE POLICY "Group admins can create invites"
  ON public.communio_invites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communio_groups cg
      JOIN public.tenant_users tu ON tu.tenant_id = cg.created_by_tenant
      WHERE cg.id = communio_invites.group_id
        AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Invited tenant admin can update (accept/decline)
CREATE POLICY "Invited tenant can respond to invites"
  ON public.communio_invites FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = communio_invites.invited_tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_communio_signal_metrics_group_week ON public.communio_signal_metrics(group_id, week_start DESC);
CREATE INDEX idx_communio_invites_tenant ON public.communio_invites(invited_tenant_id, status);
CREATE INDEX idx_communio_invites_group ON public.communio_invites(group_id, status);

-- Auto-create settings when a group is created
CREATE OR REPLACE FUNCTION public.auto_create_communio_group_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.communio_group_settings (group_id)
  VALUES (NEW.id)
  ON CONFLICT (group_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_communio_group_settings
  AFTER INSERT ON public.communio_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_communio_group_settings();
