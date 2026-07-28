
-- ═══════════════════════════════════════════════════════════
-- SCENARIO LAB + SIMULATION + SWEEP + TOUR TABLES
-- ═══════════════════════════════════════════════════════════

-- 1) demo_scenarios (registry of named test scenarios)
CREATE TABLE public.demo_scenarios (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  default_seed_profile text NOT NULL CHECK (default_seed_profile IN ('small','medium','large')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read demo_scenarios"
  ON public.demo_scenarios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin write demo_scenarios"
  ON public.demo_scenarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default scenarios
INSERT INTO public.demo_scenarios (key, display_name, description, default_seed_profile) VALUES
  ('church_small', 'Church / Faith Community', 'Small faith-based community with local outreach programs and volunteer coordination.', 'small'),
  ('gov_medium', 'Government Workforce Program', 'Mid-size government workforce development agency with regional metro coverage.', 'medium'),
  ('coalition_large', 'Digital Inclusion Coalition', 'Large multi-org coalition tracking digital equity across multiple metros.', 'large'),
  ('importer_csv', 'CSV Importer Scenario', 'Tests one-way CSV import workflows for orgs migrating from spreadsheets.', 'small'),
  ('hubspot_hybrid', 'HubSpot Hybrid Sync', 'Medium org with existing HubSpot CRM doing two-way sync migration.', 'medium');

-- 2) simulation_runs
CREATE TABLE public.simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  demo_tenant_id uuid REFERENCES public.demo_tenants(id) ON DELETE SET NULL,
  scenario_key text NOT NULL REFERENCES public.demo_scenarios(key),
  run_key text NOT NULL,
  days int NOT NULL DEFAULT 7,
  intensity text NOT NULL CHECK (intensity IN ('light','normal','heavy')),
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  stats jsonb NOT NULL DEFAULT '{}',
  error jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(tenant_id, scenario_key, run_key)
);

ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage simulation_runs"
  ON public.simulation_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) simulation_events (ledger)
CREATE TABLE public.simulation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id uuid NOT NULL REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('rim','staff','admin','system')),
  module text NOT NULL,
  action text NOT NULL,
  internal_refs jsonb NOT NULL DEFAULT '{}',
  outcome text NOT NULL CHECK (outcome IN ('ok','skipped','warning','error')),
  warnings jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulation_events_run_time
  ON public.simulation_events (simulation_run_id, occurred_at DESC);

ALTER TABLE public.simulation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage simulation_events"
  ON public.simulation_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) system_sweeps
CREATE TABLE public.system_sweeps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  demo_tenant_id uuid REFERENCES public.demo_tenants(id) ON DELETE SET NULL,
  sweep_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  steps jsonb NOT NULL DEFAULT '[]',
  scoreboard jsonb NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}',
  error jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(tenant_id, sweep_key)
);

ALTER TABLE public.system_sweeps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage system_sweeps"
  ON public.system_sweeps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) migration_fixture_packs
CREATE TABLE public.migration_fixture_packs (
  key text PRIMARY KEY,
  connector_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  files jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.migration_fixture_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage migration_fixture_packs"
  ON public.migration_fixture_packs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.migration_fixture_packs (key, connector_key, display_name, description, files) VALUES
  ('salesforce_basic_v1', 'salesforce', 'Salesforce — Basic Fixture Pack v1',
   'Standard Salesforce CSV export with edge cases: duplicate emails, missing phones, non-ISO dates, unicode, multi-line notes.',
   '["Accounts.csv","Contacts.csv","Tasks.csv","Events.csv","Notes.csv"]');

-- 6) tour_runs + tour_screenshots
CREATE TABLE public.tour_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tour_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage tour_runs"
  ON public.tour_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.tour_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_run_id uuid NOT NULL REFERENCES public.tour_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tour_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage tour_screenshots"
  ON public.tour_screenshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
