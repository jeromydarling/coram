
-- Part 1: tenant_signum_settings table
CREATE TABLE public.tenant_signum_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  assistant_micro_prompts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_signum_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only read/write
CREATE POLICY "Admins can manage signum settings"
  ON public.tenant_signum_settings
  FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[]));

-- Tenant members can read their own settings
CREATE POLICY "Tenant members read own signum settings"
  ON public.tenant_signum_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_signum_settings.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Part 2: Extend operator_narrative_metrics with friction columns
ALTER TABLE public.operator_narrative_metrics
  ADD COLUMN IF NOT EXISTS friction_idle_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS friction_repeat_nav_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS friction_abandon_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistant_intervention_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistant_resolution_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_friction_pages jsonb NOT NULL DEFAULT '[]'::jsonb;
