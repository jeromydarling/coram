
-- Phase RELATIO-N/O: Narrative Companion Mode tables

-- 1) relatio_companion_connections — tracks which ChMS a tenant connects to
CREATE TABLE IF NOT EXISTS public.relatio_companion_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','listening','error','paused')),
  auth_method text NOT NULL DEFAULT 'api_key',
  last_poll_at timestamptz NULL,
  last_poll_status text NULL,
  records_ingested integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connector_key)
);

ALTER TABLE public.relatio_companion_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage companion connections"
  ON public.relatio_companion_connections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.tenant_users tu ON tu.user_id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND tu.tenant_id = relatio_companion_connections.tenant_id
    )
  );

CREATE POLICY "Stewards can view companion connections"
  ON public.relatio_companion_connections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.tenant_users tu ON tu.user_id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'steward')
        AND tu.tenant_id = relatio_companion_connections.tenant_id
    )
  );

-- 2) relatio_staging_records — silent ingestion staging
CREATE TABLE IF NOT EXISTS public.relatio_staging_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.relatio_companion_connections(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_type text NOT NULL,
  external_id text NOT NULL,
  external_data jsonb NOT NULL DEFAULT '{}',
  narrative_signal_emitted boolean NOT NULL DEFAULT false,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id, external_type, external_id)
);

ALTER TABLE public.relatio_staging_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage staging records"
  ON public.relatio_staging_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.tenant_users tu ON tu.user_id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND tu.tenant_id = relatio_staging_records.tenant_id
    )
  );

-- Index for polling
CREATE INDEX IF NOT EXISTS idx_staging_unprocessed
  ON public.relatio_staging_records (tenant_id, narrative_signal_emitted)
  WHERE narrative_signal_emitted = false;

-- 3) Add narrative_companion_enabled to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS narrative_companion_enabled boolean NOT NULL DEFAULT false;
