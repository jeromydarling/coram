
-- Phase 7Ω: Ecosystem Health Rollups + Communio Trend Rollups

-- 1) ecosystem_health_rollups
CREATE TABLE public.ecosystem_health_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  archetype text NOT NULL,
  reflections_count int NOT NULL DEFAULT 0,
  events_count int NOT NULL DEFAULT 0,
  communio_shares int NOT NULL DEFAULT 0,
  testimonium_flags jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, week_start)
);

ALTER TABLE public.ecosystem_health_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and leadership can read ecosystem rollups"
  ON public.ecosystem_health_rollups FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::public.app_role[])
  );

CREATE POLICY "Service role inserts ecosystem rollups"
  ON public.ecosystem_health_rollups FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_ecosystem_health_tenant_week
  ON public.ecosystem_health_rollups(tenant_id, week_start DESC);

-- 2) communio_trend_rollups
CREATE TABLE public.communio_trend_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  metro_id uuid NULL REFERENCES public.metros(id),
  signal_type text NOT NULL,
  weekly_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communio_trend_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can read trend rollups"
  ON public.communio_trend_rollups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communio_memberships cm
      JOIN public.tenant_users tu ON tu.tenant_id = cm.tenant_id
      WHERE cm.group_id = communio_trend_rollups.group_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role inserts trend rollups"
  ON public.communio_trend_rollups FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_communio_trend_group_created
  ON public.communio_trend_rollups(group_id, created_at DESC);
