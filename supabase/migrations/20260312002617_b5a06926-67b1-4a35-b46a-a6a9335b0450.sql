
-- Edge function performance metrics table
CREATE TABLE public.edge_function_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  correlation_id text,
  status_code smallint,
  duration_ms integer NOT NULL,
  user_id uuid,
  tenant_id uuid,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by function and time
CREATE INDEX idx_efm_function_created ON public.edge_function_metrics (function_name, created_at DESC);
CREATE INDEX idx_efm_correlation ON public.edge_function_metrics (correlation_id) WHERE correlation_id IS NOT NULL;

-- RLS: only admins can read metrics
ALTER TABLE public.edge_function_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read metrics"
  ON public.edge_function_metrics
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow service-role inserts (no INSERT policy for authenticated = edge functions use service role)
