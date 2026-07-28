
-- Phase 7U: Connector Simulation Layer

-- 1) connector_simulation_profiles
CREATE TABLE public.connector_simulation_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_key text NOT NULL REFERENCES public.integration_connectors(key) ON DELETE CASCADE,
  profile_key text NOT NULL,
  display_name text NOT NULL,
  description text NULL,
  behavior jsonb NOT NULL DEFAULT '{}',
  seed int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connector_key, profile_key)
);

CREATE INDEX idx_sim_profiles_connector ON public.connector_simulation_profiles(connector_key, active);

ALTER TABLE public.connector_simulation_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select connector_simulation_profiles" ON public.connector_simulation_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert connector_simulation_profiles" ON public.connector_simulation_profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update connector_simulation_profiles" ON public.connector_simulation_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete connector_simulation_profiles" ON public.connector_simulation_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2) integration_test_runs
CREATE TABLE public.integration_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','production','simulation')),
  simulation_profile_key text NULL,
  test_type text NOT NULL CHECK (test_type IN ('smoke','dry_run','commit','rollback')),
  status text NOT NULL CHECK (status IN ('running','passed','failed')),
  details jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX idx_test_runs_connector ON public.integration_test_runs(connector_key, started_at DESC);
CREATE INDEX idx_test_runs_tenant ON public.integration_test_runs(tenant_id, started_at DESC);

ALTER TABLE public.integration_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select integration_test_runs" ON public.integration_test_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert integration_test_runs" ON public.integration_test_runs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update integration_test_runs" ON public.integration_test_runs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete integration_test_runs" ON public.integration_test_runs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) Add simulation columns to operator_integration_health
ALTER TABLE public.operator_integration_health
  ADD COLUMN IF NOT EXISTS simulated_runs_passed int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS simulated_runs_failed int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS real_runs_passed int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS real_runs_failed int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_rate_30d numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS last_error_code text NULL,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz NULL;

-- 4) Seed simulation profiles for all connectors
-- We seed 6 profiles per connector
INSERT INTO public.connector_simulation_profiles (connector_key, profile_key, display_name, description, behavior, seed)
SELECT
  ic.key,
  p.profile_key,
  p.display_name,
  p.description,
  p.behavior::jsonb,
  p.seed_val
FROM public.integration_connectors ic
CROSS JOIN (
  VALUES
    ('basic', 'Basic Success', 'Small dataset, all objects map cleanly.',
     '{"mode":"success","status":200,"counts":{"companies":12,"contacts":48,"activities":110,"tasks":25,"events":8},"schema_variant":"v1","latency_ms":50}', 1),
    ('empty', 'Empty Dataset', 'Zero records returned — tests graceful empty handling.',
     '{"mode":"success","status":200,"counts":{"companies":0,"contacts":0,"activities":0,"tasks":0,"events":0},"schema_variant":"v1","latency_ms":20}', 2),
    ('auth_fail', 'Auth Failure', 'Simulates invalid credentials (401).',
     '{"mode":"error","status":401,"error_code":"INVALID_AUTH","counts":{},"latency_ms":10}', 3),
    ('rate_limited', 'Rate Limited', 'Simulates 429 rate limit response.',
     '{"mode":"error","status":429,"error_code":"RATE_LIMIT","counts":{},"latency_ms":5}', 4),
    ('schema_drift', 'Schema Drift', 'Success but v2 schema omits/renames fields.',
     '{"mode":"success","status":200,"counts":{"companies":8,"contacts":30,"activities":60,"tasks":15,"events":5},"schema_variant":"v2","latency_ms":80}', 5),
    ('large', 'Large Dataset', 'High volume stress test.',
     '{"mode":"success","status":200,"counts":{"companies":500,"contacts":3000,"activities":8000,"tasks":1500,"events":200},"schema_variant":"v1","latency_ms":200}', 6)
) AS p(profile_key, display_name, description, behavior, seed_val)
WHERE ic.active = true
ON CONFLICT (connector_key, profile_key) DO NOTHING;
