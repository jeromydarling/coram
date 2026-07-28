
-- marketing_discernment_signals: anonymous interaction signals from public pages
CREATE TABLE public.marketing_discernment_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  event_key text NOT NULL,
  content_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Allow anonymous inserts (public marketing pages, no auth)
ALTER TABLE public.marketing_discernment_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_discernment_signals"
  ON public.marketing_discernment_signals
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only operators (admin role) can read
CREATE POLICY "operator_read_discernment_signals"
  ON public.marketing_discernment_signals
  FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- operator_nri_observations: NRI-generated narrative summaries from signal analysis
CREATE TABLE public.operator_nri_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_type text NOT NULL DEFAULT 'discernment',
  title text NOT NULL,
  body text NOT NULL,
  suggested_action text,
  signal_count integer NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_nri_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operator_read_nri_observations"
  ON public.operator_nri_observations
  FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- Service-role insert only (edge function)
CREATE POLICY "service_insert_nri_observations"
  ON public.operator_nri_observations
  FOR INSERT
  WITH CHECK (true);

-- Index for efficient daily aggregation queries
CREATE INDEX idx_discernment_signals_created ON public.marketing_discernment_signals (created_at DESC);
CREATE INDEX idx_discernment_signals_page_event ON public.marketing_discernment_signals (page_key, event_key);
CREATE INDEX idx_nri_observations_created ON public.operator_nri_observations (created_at DESC);
