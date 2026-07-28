
-- =====================================================
-- Phase 7F: Relatio Bridge Layer
-- =====================================================

-- 1. relatio_connectors
CREATE TABLE IF NOT EXISTS public.relatio_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('one_way', 'two_way')),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.relatio_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read connectors"
  ON public.relatio_connectors FOR SELECT TO authenticated USING (true);

INSERT INTO public.relatio_connectors (key, name, mode, description) VALUES
  ('hubspot', 'HubSpot', 'two_way', 'Two-way sync with HubSpot CRM. Keep both systems in harmony, or pull once and move on.'),
  ('salesforce', 'Salesforce', 'one_way', 'Import organizations, contacts, and activities from Salesforce via CSV export.'),
  ('airtable', 'Airtable', 'one_way', 'Import structured data from Airtable bases via CSV export.'),
  ('csv', 'CSV Upload', 'one_way', 'Upload a CSV file to import organizations, contacts, activities, or tasks.')
ON CONFLICT (key) DO NOTHING;

-- 2. relatio_connections
CREATE TABLE IF NOT EXISTS public.relatio_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_key text NOT NULL REFERENCES public.relatio_connectors(key),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'error')),
  oauth_json jsonb NULL,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_key)
);

ALTER TABLE public.relatio_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_select" ON public.relatio_connections FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "rc_insert" ON public.relatio_connections FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    JOIN public.user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid() AND ur.role = 'admin'
  ));

CREATE POLICY "rc_update" ON public.relatio_connections FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    JOIN public.user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid() AND ur.role = 'admin'
  ));

CREATE POLICY "rc_delete" ON public.relatio_connections FOR DELETE TO authenticated
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    JOIN public.user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid() AND ur.role = 'admin'
  ));

-- 3. relatio_import_jobs
CREATE TABLE IF NOT EXISTS public.relatio_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'canceled')),
  scope jsonb NOT NULL DEFAULT '{}',
  progress jsonb NOT NULL DEFAULT '{}',
  error jsonb NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_relatio_import_jobs_tenant ON public.relatio_import_jobs (tenant_id, created_at DESC);
ALTER TABLE public.relatio_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rij_select" ON public.relatio_import_jobs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "rij_insert" ON public.relatio_import_jobs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    JOIN public.user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid() AND ur.role = 'admin'
  ));

CREATE POLICY "rij_update" ON public.relatio_import_jobs FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    JOIN public.user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid() AND ur.role = 'admin'
  ));

-- 4. relatio_import_events
CREATE TABLE IF NOT EXISTS public.relatio_import_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.relatio_import_jobs(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_relatio_import_events_job ON public.relatio_import_events (job_id, created_at DESC);
ALTER TABLE public.relatio_import_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rie_select" ON public.relatio_import_events FOR SELECT TO authenticated
  USING (job_id IN (
    SELECT rij.id FROM public.relatio_import_jobs rij
    JOIN public.tenant_users tu ON tu.tenant_id = rij.tenant_id
    WHERE tu.user_id = auth.uid()
  ));

CREATE POLICY "rie_insert" ON public.relatio_import_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5. relatio_object_map
CREATE TABLE IF NOT EXISTS public.relatio_object_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  external_type text NOT NULL,
  external_id text NOT NULL,
  internal_table text NOT NULL,
  internal_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_key, external_type, external_id)
);

CREATE INDEX idx_relatio_object_map_lookup ON public.relatio_object_map (tenant_id, connector_key, internal_table);
ALTER TABLE public.relatio_object_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rom_select" ON public.relatio_object_map FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "rom_insert" ON public.relatio_object_map FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "rom_update" ON public.relatio_object_map FOR UPDATE TO authenticated
  USING (true);
