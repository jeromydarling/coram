
-- ============================================================
-- Phase 7T: Relatio Marketplace — Schema Additions
-- ============================================================

-- 1) Add missing columns to relatio_connectors
ALTER TABLE public.relatio_connectors
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'one_way_in';

-- 2) Add missing columns to relatio_installations  
ALTER TABLE public.relatio_installations
  ADD COLUMN IF NOT EXISTS environment text DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS auth_type text DEFAULT 'api_key',
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 3) relatio_sync_jobs — tracks import/export runs
CREATE TABLE IF NOT EXISTS public.relatio_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connector_key text NOT NULL REFERENCES public.relatio_connectors(key),
  direction text NOT NULL DEFAULT 'pull' CHECK (direction IN ('pull','push')),
  mode text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run','commit')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  summary jsonb DEFAULT '{}',
  error jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_relatio_sync_jobs_tenant
  ON public.relatio_sync_jobs (tenant_id, started_at DESC);

-- 4) relatio_sync_items — per-object log
CREATE TABLE IF NOT EXISTS public.relatio_sync_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid NOT NULL REFERENCES public.relatio_sync_jobs(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  action text NOT NULL CHECK (action IN ('created','updated','skipped','error')),
  external_id text,
  internal_id uuid,
  warnings jsonb DEFAULT '[]',
  sample jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relatio_sync_items_job
  ON public.relatio_sync_items (sync_job_id, object_type);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.relatio_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatio_sync_items ENABLE ROW LEVEL SECURITY;

-- Sync jobs: tenant members can read their own; admin can read all
CREATE POLICY "Tenant members read own sync jobs"
  ON public.relatio_sync_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = relatio_sync_jobs.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin insert sync jobs"
  ON public.relatio_sync_jobs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update sync jobs"
  ON public.relatio_sync_jobs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Sync items: readable via job access
CREATE POLICY "Read sync items via job"
  ON public.relatio_sync_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.relatio_sync_jobs j
      JOIN public.tenant_users tu ON tu.tenant_id = j.tenant_id AND tu.user_id = auth.uid()
      WHERE j.id = relatio_sync_items.sync_job_id
    )
  );

CREATE POLICY "Admin insert sync items"
  ON public.relatio_sync_items FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Seed / update connectors
-- ============================================================

INSERT INTO public.relatio_connectors (key, name, mode, direction, category, icon, description, active)
VALUES
  ('hubspot',       'HubSpot',        'two_way',  'two_way',     'crm',       'hub',         'Two-way sync with HubSpot CRM. Mirror contacts, companies, and activities.', true),
  ('salesforce',    'Salesforce',     'one_way',  'one_way_in',  'crm',       'cloud',       'Import accounts, contacts, and activities from Salesforce.', true),
  ('bloomerang',    'Bloomerang',     'one_way',  'one_way_in',  'crm',       'flower',      'Import constituents and interactions from Bloomerang.', true),
  ('blackbaud',     'Blackbaud',      'one_way',  'one_way_in',  'crm',       'building',    'Import constituents from Blackbaud / Raiser''s Edge.', true),
  ('neoncrm',       'NeonCRM',        'one_way',  'one_way_in',  'crm',       'zap',         'Import accounts and contacts from NeonCRM.', true),
  ('donorperfect',  'DonorPerfect',   'one_way',  'one_way_in',  'crm',       'heart',       'Import constituents from DonorPerfect.', true),
  ('kindful',       'Kindful',        'one_way',  'one_way_in',  'crm',       'hand-heart',  'Import contacts and interactions from Kindful.', true),
  ('nationbuilder', 'NationBuilder',  'one_way',  'one_way_in',  'crm',       'flag',        'Import people and tags from NationBuilder.', true),
  ('airtable',      'Airtable',       'one_way',  'one_way_in',  'data',      'table',       'Import structured data from Airtable bases.', true),
  ('zoho',          'Zoho CRM',       'one_way',  'one_way_in',  'crm',       'briefcase',   'Import accounts and contacts from Zoho CRM.', true),
  ('pipedrive',     'Pipedrive',      'one_way',  'one_way_in',  'crm',       'target',      'Import organizations and people from Pipedrive.', true),
  ('csv',           'CSV Upload',     'one_way',  'one_way_in',  'data',      'file-up',     'Import relationships from a CSV file.', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  direction = EXCLUDED.direction,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;
