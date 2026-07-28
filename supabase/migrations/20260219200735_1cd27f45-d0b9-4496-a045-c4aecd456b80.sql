
-- ════════════════════════════════════════════════════════════════
-- Phase 7S: Testimonium Export Layer
-- ════════════════════════════════════════════════════════════════

-- 1. testimonium_exports
CREATE TABLE public.testimonium_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  export_type text NOT NULL CHECK (export_type IN ('monthly','quarterly','custom')),
  narrative_outline jsonb NOT NULL DEFAULT '{}',
  metrics_snapshot jsonb NOT NULL DEFAULT '{}',
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_testimonium_exports_tenant_date ON public.testimonium_exports (tenant_id, created_at DESC);

ALTER TABLE public.testimonium_exports ENABLE ROW LEVEL SECURITY;

-- Tenant users can read their own exports
CREATE POLICY "Tenant users can read own exports"
  ON public.testimonium_exports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = testimonium_exports.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Leadership + admin can insert
CREATE POLICY "Leadership and admin can create exports"
  ON public.testimonium_exports FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = testimonium_exports.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admin can delete
CREATE POLICY "Admin can delete exports"
  ON public.testimonium_exports FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. testimonium_export_sections
CREATE TABLE public.testimonium_export_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id uuid NOT NULL REFERENCES public.testimonium_exports(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  title text NOT NULL,
  body jsonb NOT NULL DEFAULT '{}',
  order_index int NOT NULL DEFAULT 0
);

ALTER TABLE public.testimonium_export_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sections inherit export access"
  ON public.testimonium_export_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.testimonium_exports te
      JOIN public.tenant_users tu ON tu.tenant_id = te.tenant_id
      WHERE te.id = testimonium_export_sections.export_id AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Sections insertable by tenant users"
  ON public.testimonium_export_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.testimonium_exports te
      JOIN public.tenant_users tu ON tu.tenant_id = te.tenant_id
      WHERE te.id = testimonium_export_sections.export_id AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can delete sections"
  ON public.testimonium_export_sections FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
