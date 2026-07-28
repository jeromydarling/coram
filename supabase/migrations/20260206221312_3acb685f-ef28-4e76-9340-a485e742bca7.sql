
-- ============================================================
-- n8n Ingest Tables
-- ============================================================

-- 1. automation_runs – one row per n8n execution
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL UNIQUE,
  workflow_key text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid,
  org_name text,
  metro_id uuid REFERENCES public.metros(id) ON DELETE SET NULL,
  inputs_hash text,
  payload jsonb,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read automation_runs"
  ON public.automation_runs FOR SELECT TO authenticated USING (true);

-- 2. org_extractions – raw extraction per org per run
CREATE TABLE public.org_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.automation_runs(run_id) ON DELETE CASCADE,
  org_name text NOT NULL,
  website_url text,
  raw_extraction jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read org_extractions"
  ON public.org_extractions FOR SELECT TO authenticated USING (true);

-- 3. org_enrichment_facts – structured facts from extraction
CREATE TABLE public.org_enrichment_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id uuid NOT NULL REFERENCES public.org_extractions(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES public.automation_runs(run_id) ON DELETE CASCADE,
  org_name text NOT NULL,
  mission_summary text,
  programs text[],
  populations_served text[],
  geographies text[],
  funding_signals text[],
  keywords text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_enrichment_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read org_enrichment_facts"
  ON public.org_enrichment_facts FOR SELECT TO authenticated USING (true);

-- 4. opportunity_signals – signals detected per opportunity per run
CREATE TABLE public.opportunity_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.automation_runs(run_id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  signal_value text,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  source_url text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunity_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read opportunity_signals"
  ON public.opportunity_signals FOR SELECT TO authenticated USING (true);

-- 5. ai_recommendations – AI-generated recommendations, unique per metro + inputs_hash
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.automation_runs(run_id) ON DELETE CASCADE,
  metro_id uuid REFERENCES public.metros(id) ON DELETE SET NULL,
  inputs_hash text NOT NULL,
  recommendation_type text NOT NULL,
  title text NOT NULL,
  body text,
  priority text DEFAULT 'medium',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metro_id, inputs_hash)
);

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_recommendations"
  ON public.ai_recommendations FOR SELECT TO authenticated USING (true);

-- Indexes for common lookups
CREATE INDEX idx_automation_runs_workflow_key ON public.automation_runs(workflow_key);
CREATE INDEX idx_automation_runs_status ON public.automation_runs(status);
CREATE INDEX idx_org_extractions_run_id ON public.org_extractions(run_id);
CREATE INDEX idx_org_enrichment_facts_run_id ON public.org_enrichment_facts(run_id);
CREATE INDEX idx_opportunity_signals_run_id ON public.opportunity_signals(run_id);
CREATE INDEX idx_opportunity_signals_opportunity_id ON public.opportunity_signals(opportunity_id);
CREATE INDEX idx_ai_recommendations_metro_id ON public.ai_recommendations(metro_id);
