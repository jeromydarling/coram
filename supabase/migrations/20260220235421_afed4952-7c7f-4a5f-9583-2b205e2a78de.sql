
-- QA Employee tables

-- QA Test Suites
CREATE TABLE public.qa_test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_test_suites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_qa_suites" ON public.qa_test_suites FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_manage_qa_suites" ON public.qa_test_suites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- QA Test Runs
CREATE TABLE public.qa_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  suite_key text NOT NULL REFERENCES public.qa_test_suites(key),
  triggered_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','passed','failed','partial')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}',
  environment text NOT NULL DEFAULT 'github_actions',
  browserbase_session_id text,
  error jsonb,
  github_run_id text
);
ALTER TABLE public.qa_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_qa_runs" ON public.qa_test_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_manage_qa_runs" ON public.qa_test_runs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- QA Test Run Steps
CREATE TABLE public.qa_test_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.qa_test_runs(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  step_key text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','passed','failed','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  url text,
  screenshot_path text,
  console_errors jsonb NOT NULL DEFAULT '[]',
  page_errors jsonb NOT NULL DEFAULT '[]',
  network_failures jsonb NOT NULL DEFAULT '[]',
  notes text,
  UNIQUE(run_id, step_index)
);
ALTER TABLE public.qa_test_run_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_qa_steps" ON public.qa_test_run_steps FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_manage_qa_steps" ON public.qa_test_run_steps FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- QA Test Run Artifacts
CREATE TABLE public.qa_test_run_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.qa_test_runs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('final_report','raw_playwright_log','trace','video')),
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_test_run_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_qa_artifacts" ON public.qa_test_run_artifacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_manage_qa_artifacts" ON public.qa_test_run_artifacts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- QA Screenshots storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('qa_screenshots', 'qa_screenshots', false);

-- Storage policies: admin read, service-role insert
CREATE POLICY "admin_read_qa_screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'qa_screenshots' AND public.has_role(auth.uid(), 'admin'));

-- Seed core smoke suite
INSERT INTO public.qa_test_suites (key, name, description) VALUES ('core_smoke_v1', 'Core Smoke Test', 'Login, dashboard, opportunities, reflection, events, provisions, logout — captures screenshots and errors at each step.');
