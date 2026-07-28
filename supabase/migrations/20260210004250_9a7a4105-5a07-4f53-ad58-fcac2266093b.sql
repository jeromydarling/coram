
-- ============================================================
-- Discovery Search: search_runs + search_results
-- ============================================================

-- search_runs: tracks each discovery search dispatched to n8n
CREATE TABLE public.search_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE,
  search_type text NOT NULL CHECK (search_type IN ('event', 'opportunity', 'grant')),
  query text NOT NULL,
  intent_keywords text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result_count int NOT NULL DEFAULT 0,
  error_message text,
  requested_by uuid NOT NULL,
  metro_id uuid REFERENCES public.metros(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- search_results: individual results from a search run
CREATE TABLE public.search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_run_id uuid NOT NULL REFERENCES public.search_runs(id) ON DELETE CASCADE,
  result_index int NOT NULL,
  title text NOT NULL,
  description text,
  url text,
  source text,
  location text,
  date_info text,
  organization text,
  contact_name text,
  contact_email text,
  contact_phone text,
  confidence numeric(3,2),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  entity_created boolean NOT NULL DEFAULT false,
  created_entity_id uuid,
  created_entity_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(search_run_id, result_index)
);

-- Indexes
CREATE INDEX idx_search_runs_type_user ON public.search_runs(search_type, requested_by);
CREATE INDEX idx_search_runs_status ON public.search_runs(status, created_at);
CREATE INDEX idx_search_results_run ON public.search_results(search_run_id);

-- Updated_at trigger for search_runs
CREATE TRIGGER update_search_runs_updated_at
  BEFORE UPDATE ON public.search_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.search_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_results ENABLE ROW LEVEL SECURITY;

-- Users can only see their own search runs
CREATE POLICY "Users see own search runs"
  ON public.search_runs FOR SELECT
  USING (auth.uid() = requested_by);

-- Users can only see results from their own search runs
CREATE POLICY "Users see own search results"
  ON public.search_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.search_runs sr
      WHERE sr.id = search_results.search_run_id
      AND sr.requested_by = auth.uid()
    )
  );

-- No direct INSERT/UPDATE/DELETE from clients (service role only via Edge Functions)
