
-- =============================================
-- PHASE 7H: Demo Lab + Migration Harness tables
-- =============================================

-- 1) demo_tenants
CREATE TABLE public.demo_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  seed_profile text NOT NULL CHECK (seed_profile IN ('small','medium','large')),
  seed_version int NOT NULL DEFAULT 1,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.demo_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select demo_tenants" ON public.demo_tenants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert demo_tenants" ON public.demo_tenants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update demo_tenants" ON public.demo_tenants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete demo_tenants" ON public.demo_tenants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2) demo_seed_runs
CREATE TABLE public.demo_seed_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_tenant_id uuid NOT NULL REFERENCES public.demo_tenants(id) ON DELETE CASCADE,
  run_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  stats jsonb NOT NULL DEFAULT '{}',
  error jsonb NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz NULL,
  UNIQUE(demo_tenant_id, run_key)
);

ALTER TABLE public.demo_seed_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select demo_seed_runs" ON public.demo_seed_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert demo_seed_runs" ON public.demo_seed_runs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update demo_seed_runs" ON public.demo_seed_runs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete demo_seed_runs" ON public.demo_seed_runs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) integration_connectors (registry)
CREATE TABLE public.integration_connectors (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('one_way_in','two_way')),
  supports_oauth boolean NOT NULL DEFAULT false,
  supports_csv boolean NOT NULL DEFAULT true,
  supports_api boolean NOT NULL DEFAULT false,
  notes text NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.integration_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select integration_connectors" ON public.integration_connectors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert integration_connectors" ON public.integration_connectors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update integration_connectors" ON public.integration_connectors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed connector registry
INSERT INTO public.integration_connectors (key, display_name, direction, supports_oauth, supports_csv, supports_api, notes) VALUES
  ('hubspot',       'HubSpot',             'two_way',    true,  true,  true,  'Full two-way sync supported'),
  ('salesforce',    'Salesforce',           'one_way_in', true,  true,  true,  'Export-based or Connected App OAuth'),
  ('bloomerang',    'Bloomerang',           'one_way_in', false, true,  true,  'API key or CSV export'),
  ('blackbaud',     'Blackbaud / Raiser''s Edge', 'one_way_in', true,  true,  false, 'SKY API OAuth or export'),
  ('neoncrm',       'NeonCRM',             'one_way_in', false, true,  true,  'API key or CSV export'),
  ('donorperfect',  'DonorPerfect',        'one_way_in', false, true,  true,  'API or CSV export'),
  ('kindful',       'Kindful',             'one_way_in', false, true,  false, 'CSV export only'),
  ('nationbuilder', 'NationBuilder',       'one_way_in', true,  true,  true,  'OAuth or CSV export'),
  ('airtable',      'Airtable',            'one_way_in', true,  true,  true,  'Personal access token or OAuth'),
  ('zoho',          'Zoho CRM',            'one_way_in', true,  true,  true,  'OAuth or CSV export'),
  ('pipedrive',     'Pipedrive',           'one_way_in', false, true,  true,  'API token or CSV export'),
  ('littlegreenlight','Little Green Light', 'one_way_in', false, true,  false, 'CSV export only');

-- 4) integration_connections
CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connector_key text NOT NULL REFERENCES public.integration_connectors(key),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connected','error')),
  auth_type text NOT NULL CHECK (auth_type IN ('oauth','api_key','csv')),
  external_account_label text NULL,
  settings jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, connector_key, environment)
);

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select integration_connections" ON public.integration_connections FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert integration_connections" ON public.integration_connections FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update integration_connections" ON public.integration_connections FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete integration_connections" ON public.integration_connections FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5) migration_runs
CREATE TABLE public.migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connector_key text NOT NULL REFERENCES public.integration_connectors(key),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  mode text NOT NULL CHECK (mode IN ('dry_run','commit')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','rolled_back')),
  source_summary jsonb NOT NULL DEFAULT '{}',
  mapping_summary jsonb NOT NULL DEFAULT '{}',
  results_summary jsonb NOT NULL DEFAULT '{}',
  error jsonb NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz NULL
);

ALTER TABLE public.migration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select migration_runs" ON public.migration_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert migration_runs" ON public.migration_runs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update migration_runs" ON public.migration_runs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) migration_run_items
CREATE TABLE public.migration_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id uuid NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  action text NOT NULL CHECK (action IN ('mapped','created','updated','skipped','error')),
  external_id text NULL,
  internal_id uuid NULL,
  warnings jsonb DEFAULT '[]',
  sample jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_migration_run_items_run_type ON public.migration_run_items (migration_run_id, object_type);

ALTER TABLE public.migration_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select migration_run_items" ON public.migration_run_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert migration_run_items" ON public.migration_run_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7) migration_field_mappings
CREATE TABLE public.migration_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connector_key text NOT NULL REFERENCES public.integration_connectors(key),
  object_type text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, connector_key, object_type)
);

ALTER TABLE public.migration_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select migration_field_mappings" ON public.migration_field_mappings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert migration_field_mappings" ON public.migration_field_mappings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update migration_field_mappings" ON public.migration_field_mappings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_demo_tenants_created ON public.demo_tenants (created_at DESC);
CREATE INDEX idx_migration_runs_tenant ON public.migration_runs (tenant_id, started_at DESC);
CREATE INDEX idx_integration_connections_tenant ON public.integration_connections (tenant_id, connector_key);
