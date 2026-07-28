
-- ═══════════════════════════════════════════════════════════
-- OPERATOR TEST HARNESS TABLES
-- ═══════════════════════════════════════════════════════════

-- 1) Test suites (registry)
CREATE TABLE public.operator_test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operator_test_suites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read test suites"
  ON public.operator_test_suites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed suites
INSERT INTO public.operator_test_suites (key, name, description) VALUES
  ('outlook_connect', 'Outlook Connection Test', 'Verify Outlook OAuth connection via Graph /me, inbox header, draft create/delete — no emails sent.'),
  ('unsubscribe_flow', 'Unsubscribe Flow Test', 'Generate unsubscribe token, execute unsubscribe, verify suppression row and event log.'),
  ('campaign_suppression', 'Campaign Suppression Gate Test', 'Verify suppressed recipients are excluded from campaign audience preflight.');

-- 2) Test runs
CREATE TABLE public.operator_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  suite_key text NOT NULL REFERENCES public.operator_test_suites(key),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  status text NOT NULL CHECK (status IN ('running', 'passed', 'failed')),
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}',
  error jsonb
);
ALTER TABLE public.operator_test_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_operator_test_runs_tenant ON public.operator_test_runs (tenant_id, started_at DESC);
CREATE INDEX idx_operator_test_runs_suite ON public.operator_test_runs (suite_key, started_at DESC);

CREATE POLICY "Admin manage test runs"
  ON public.operator_test_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Test run steps
CREATE TABLE public.operator_test_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.operator_test_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'skipped')),
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operator_test_run_steps ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_operator_test_run_steps_run ON public.operator_test_run_steps (test_run_id);

CREATE POLICY "Admin manage test run steps"
  ON public.operator_test_run_steps FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
