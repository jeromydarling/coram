-- QA Self-Healing Tables

-- 1) qa_run_failures: structured failure evidence
CREATE TABLE public.qa_run_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.qa_test_runs(id) ON DELETE CASCADE,
  suite_key text NOT NULL,
  failure_type text NOT NULL CHECK (failure_type IN ('assertion','timeout','network','auth','ui_mismatch','server_error','unknown')),
  primary_message text NOT NULL,
  stack_trace text NULL,
  console_errors jsonb NOT NULL DEFAULT '[]',
  network_errors jsonb NOT NULL DEFAULT '[]',
  last_step jsonb NOT NULL DEFAULT '{}',
  artifact_refs jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_run_failures_run_id ON public.qa_run_failures(run_id);

ALTER TABLE public.qa_run_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage qa_run_failures"
  ON public.qa_run_failures
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) qa_fix_prompts: generated fix prompts
CREATE TABLE public.qa_fix_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.qa_test_runs(id) ON DELETE CASCADE,
  suite_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  title text NOT NULL,
  prompt_text text NOT NULL,
  root_cause_hypotheses jsonb NOT NULL DEFAULT '[]',
  suggested_files jsonb NOT NULL DEFAULT '[]',
  redactions jsonb NOT NULL DEFAULT '[]',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_fix_prompts_run_status ON public.qa_fix_prompts(run_id, status);

ALTER TABLE public.qa_fix_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage qa_fix_prompts"
  ON public.qa_fix_prompts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) qa_known_issues: fingerprinted known issues
CREATE TABLE public.qa_known_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  suggested_fix text NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_known_issues_fingerprint ON public.qa_known_issues(fingerprint);

ALTER TABLE public.qa_known_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage qa_known_issues"
  ON public.qa_known_issues
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));