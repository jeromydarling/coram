
-- Praeceptum guidance memory table
CREATE TABLE public.praeceptum_guidance_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  archetype_key text,
  context text NOT NULL,
  prompt_key text NOT NULL,
  intervention_count int NOT NULL DEFAULT 0,
  resolution_count int NOT NULL DEFAULT 0,
  friction_after_count int NOT NULL DEFAULT 0,
  confidence_score numeric NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_praeceptum_tenant_context ON public.praeceptum_guidance_memory(tenant_id, context);
CREATE INDEX idx_praeceptum_prompt_key ON public.praeceptum_guidance_memory(prompt_key);
CREATE UNIQUE INDEX idx_praeceptum_upsert ON public.praeceptum_guidance_memory(tenant_id, context, prompt_key);

ALTER TABLE public.praeceptum_guidance_memory ENABLE ROW LEVEL SECURITY;

-- Tenant users can insert
CREATE POLICY "praeceptum_insert_authenticated" ON public.praeceptum_guidance_memory
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = praeceptum_guidance_memory.tenant_id AND tu.user_id = auth.uid())
  );

-- Tenant users can read their own tenant
CREATE POLICY "praeceptum_select_tenant" ON public.praeceptum_guidance_memory
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = praeceptum_guidance_memory.tenant_id AND tu.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[])
  );

-- Admins and service can update
CREATE POLICY "praeceptum_update_admin" ON public.praeceptum_guidance_memory
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = praeceptum_guidance_memory.tenant_id AND tu.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[])
  );

-- Tenant praeceptum settings
CREATE TABLE public.tenant_praeceptum_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  adaptive_prompting boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_praeceptum_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "praeceptum_settings_select" ON public.tenant_praeceptum_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = tenant_praeceptum_settings.tenant_id AND tu.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[])
  );

CREATE POLICY "praeceptum_settings_upsert" ON public.tenant_praeceptum_settings
  FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.tenant_id = tenant_praeceptum_settings.tenant_id
        AND tu.user_id = auth.uid()
        AND ur.role = 'steward'
    )
  );
