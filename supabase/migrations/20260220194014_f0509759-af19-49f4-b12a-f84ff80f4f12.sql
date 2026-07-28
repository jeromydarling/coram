
-- expansion_signals: captures cross-metro behavioral signals per tenant
CREATE TABLE public.expansion_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  metro_id uuid NOT NULL REFERENCES public.metros(id),
  signal_type text NOT NULL,
  weight int NOT NULL DEFAULT 1,
  source_module text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_expansion_signals_tenant_created ON public.expansion_signals (tenant_id, created_at DESC);

ALTER TABLE public.expansion_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view expansion signals"
  ON public.expansion_signals FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::public.app_role[]));

CREATE POLICY "Service role can insert expansion signals"
  ON public.expansion_signals FOR INSERT
  WITH CHECK (true);

-- expansion_moments: aggregated moment detection results
CREATE TABLE public.expansion_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  detected_at timestamptz DEFAULT now(),
  score int NOT NULL DEFAULT 0,
  suggested boolean DEFAULT false,
  acknowledged boolean DEFAULT false
);

CREATE INDEX idx_expansion_moments_tenant ON public.expansion_moments (tenant_id);

ALTER TABLE public.expansion_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and tenant leadership can view expansion moments"
  ON public.expansion_moments FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::public.app_role[])
    OR public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "Service role can insert expansion moments"
  ON public.expansion_moments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Tenant members can update own expansion moments"
  ON public.expansion_moments FOR UPDATE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
