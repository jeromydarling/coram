
-- ============================================
-- RELATIO MARKETPLACE TABLES
-- ============================================

-- 1) Catalog of available integrations
CREATE TABLE public.relatio_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'crm',
  description text,
  icon text,
  is_two_way boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.relatio_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read integrations"
  ON public.relatio_integrations FOR SELECT TO authenticated USING (true);

-- Seed integrations
INSERT INTO public.relatio_integrations (key, name, category, description, icon, is_two_way) VALUES
  ('hubspot',          'HubSpot',          'crm',          'Two-way sync with HubSpot CRM — companies, contacts, deals.', 'building-2', true),
  ('salesforce',       'Salesforce',       'crm',          'Import accounts, contacts, and opportunities from Salesforce.', 'cloud', false),
  ('bloomerang',       'Bloomerang',       'nonprofit',    'Import donors and interactions from Bloomerang.', 'heart', false),
  ('neoncrm',          'Neon CRM',         'nonprofit',    'Import constituents and activities from Neon CRM.', 'zap', false),
  ('planning_center',  'Planning Center',  'church',       'Import people and groups from Planning Center.', 'users', false),
  ('mailchimp',        'Mailchimp',        'email',        'Import audiences and contact lists from Mailchimp.', 'mail', false),
  ('google_contacts',  'Google Contacts',  'contacts',     'Import your Google Contacts into CROS.', 'contact', false);


-- 2) Per-tenant installations
CREATE TABLE public.relatio_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_key text NOT NULL REFERENCES public.relatio_integrations(key),
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, integration_key)
);
ALTER TABLE public.relatio_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view installations"
  ON public.relatio_installations FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant members can manage installations"
  ON public.relatio_installations FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE TRIGGER update_relatio_installations_updated_at
  BEFORE UPDATE ON public.relatio_installations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) Migration runs
CREATE TABLE public.relatio_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  migration_status text NOT NULL DEFAULT 'pending' CHECK (migration_status IN ('pending', 'running', 'completed', 'failed')),
  records_imported int DEFAULT 0,
  warnings jsonb DEFAULT '[]',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.relatio_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view migrations"
  ON public.relatio_migrations FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant members can insert migrations"
  ON public.relatio_migrations FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant members can update migrations"
  ON public.relatio_migrations FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE INDEX idx_relatio_migrations_tenant_key ON public.relatio_migrations (tenant_id, integration_key);


-- 4) Field mapping templates
CREATE TABLE public.relatio_field_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key text NOT NULL,
  source_field text NOT NULL,
  target_field text NOT NULL,
  direction text NOT NULL DEFAULT 'import' CHECK (direction IN ('import', 'export', 'both'))
);
ALTER TABLE public.relatio_field_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read field maps"
  ON public.relatio_field_maps FOR SELECT TO authenticated USING (true);

-- Seed default field mappings (generic, applies to all CRM imports)
INSERT INTO public.relatio_field_maps (integration_key, source_field, target_field, direction) VALUES
  ('_default', 'contacts',    'people',          'import'),
  ('_default', 'companies',   'opportunities',   'import'),
  ('_default', 'notes',       'reflections',     'import'),
  ('_default', 'tasks',       'tasks',           'import'),
  ('_default', 'emails',      'communications',  'import'),
  ('hubspot',  'contacts',    'people',          'both'),
  ('hubspot',  'companies',   'opportunities',   'both'),
  ('hubspot',  'notes',       'reflections',     'export'),
  ('hubspot',  'tasks',       'tasks',           'export');
