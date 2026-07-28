
-- Phase 7I: Operator Console aggregation tables

-- 1) operator_tenant_stats
CREATE TABLE public.operator_tenant_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  archetype text NOT NULL DEFAULT 'unknown',
  active_users int NOT NULL DEFAULT 0,
  opportunities_count int NOT NULL DEFAULT 0,
  events_count int NOT NULL DEFAULT 0,
  reflections_count int NOT NULL DEFAULT 0,
  narrative_signals_count int NOT NULL DEFAULT 0,
  communio_opt_in boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_operator_tenant_stats_tenant ON public.operator_tenant_stats(tenant_id);
CREATE INDEX idx_operator_tenant_stats_archetype ON public.operator_tenant_stats(archetype);

ALTER TABLE public.operator_tenant_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select operator_tenant_stats"
  ON public.operator_tenant_stats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service insert/update operator_tenant_stats"
  ON public.operator_tenant_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) operator_integration_health
CREATE TABLE public.operator_integration_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  last_sync_at timestamptz,
  last_status text NOT NULL DEFAULT 'ok' CHECK (last_status IN ('ok','warning','error')),
  success_rate numeric NOT NULL DEFAULT 100,
  error_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_operator_int_health_uniq ON public.operator_integration_health(tenant_id, connector_key, environment);

ALTER TABLE public.operator_integration_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select operator_integration_health"
  ON public.operator_integration_health FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service all operator_integration_health"
  ON public.operator_integration_health FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) operator_narrative_metrics
CREATE TABLE public.operator_narrative_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  signal_count int NOT NULL DEFAULT 0,
  drift_events int NOT NULL DEFAULT 0,
  heatmap_updates int NOT NULL DEFAULT 0,
  testimonium_runs int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_operator_narrative_tenant ON public.operator_narrative_metrics(tenant_id);

ALTER TABLE public.operator_narrative_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select operator_narrative_metrics"
  ON public.operator_narrative_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service all operator_narrative_metrics"
  ON public.operator_narrative_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4) operator_archetype_metrics
CREATE TABLE public.operator_archetype_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype text NOT NULL,
  tenant_count int NOT NULL DEFAULT 0,
  avg_days_to_first_reflection numeric DEFAULT 0,
  avg_days_to_first_event numeric DEFAULT 0,
  avg_days_to_first_signal numeric DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_operator_archetype_key ON public.operator_archetype_metrics(archetype);

ALTER TABLE public.operator_archetype_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select operator_archetype_metrics"
  ON public.operator_archetype_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service all operator_archetype_metrics"
  ON public.operator_archetype_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
