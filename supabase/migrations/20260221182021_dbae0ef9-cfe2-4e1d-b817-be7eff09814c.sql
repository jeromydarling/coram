
-- Batch QA run tracking
CREATE TABLE public.qa_batch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  triggered_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  suite_keys text[] NOT NULL DEFAULT '{}',
  current_index int NOT NULL DEFAULT 0,
  run_ids uuid[] NOT NULL DEFAULT '{}',
  results jsonb NOT NULL DEFAULT '[]',
  delay_seconds int NOT NULL DEFAULT 30,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_qa_batch_runs_tenant ON public.qa_batch_runs(tenant_id);
CREATE INDEX idx_qa_batch_runs_status ON public.qa_batch_runs(status);

-- Add batch_id to qa_test_runs so callback can find the batch
ALTER TABLE public.qa_test_runs ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.qa_batch_runs(id);

-- RLS
ALTER TABLE public.qa_batch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read qa_batch_runs" ON public.qa_batch_runs
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[])
  );

CREATE POLICY "Service insert qa_batch_runs" ON public.qa_batch_runs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update qa_batch_runs" ON public.qa_batch_runs
  FOR UPDATE USING (true);
