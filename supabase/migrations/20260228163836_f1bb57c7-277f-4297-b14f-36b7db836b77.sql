
-- ============================================================
-- Phase 24: Providence Engine — Database Layer
-- ============================================================

-- 1) providence_reports — tenant-scoped seasonal arc reports
CREATE TABLE public.providence_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  season_label TEXT NOT NULL,
  dominant_direction TEXT NOT NULL CHECK (dominant_direction IN ('care','expansion','restoration','steadfastness')),
  classification TEXT NOT NULL,
  arc_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative_private TEXT NOT NULL DEFAULT '',
  narrative_shareable TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('quarterly','arc_shift','manual')),
  version INT NOT NULL DEFAULT 1,
  created_by UUID
);

ALTER TABLE public.providence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read providence reports"
  ON public.providence_reports FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can insert providence reports"
  ON public.providence_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE INDEX idx_providence_reports_tenant ON public.providence_reports(tenant_id, generated_at DESC);
CREATE INDEX idx_providence_reports_period ON public.providence_reports(tenant_id, period_start, period_end);

-- 2) providence_constellation_signals — anonymized aggregate for Gardener
CREATE TABLE public.providence_constellation_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_key TEXT NOT NULL,
  archetype TEXT NOT NULL,
  dominant_direction TEXT NOT NULL CHECK (dominant_direction IN ('care','expansion','restoration','steadfastness')),
  classification TEXT NOT NULL,
  intensity NUMERIC NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.providence_constellation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read constellation signals"
  ON public.providence_constellation_signals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert constellation signals"
  ON public.providence_constellation_signals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_constellation_signals_region ON public.providence_constellation_signals(region_key, generated_at DESC);
