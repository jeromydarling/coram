
-- Lumen signals table
CREATE TABLE public.lumen_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  confidence numeric NOT NULL DEFAULT 0,
  source_summary jsonb NOT NULL DEFAULT '{}',
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_lumen_signals_tenant_type ON public.lumen_signals (tenant_id, signal_type);
CREATE INDEX idx_lumen_signals_tenant_metro ON public.lumen_signals (tenant_id, metro_id);

-- Validation trigger (not CHECK for safety)
CREATE OR REPLACE FUNCTION public.validate_lumen_signal() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.signal_type NOT IN ('drift_risk','activation_delay','migration_fragility','volunteer_dropoff','expansion_ready','narrative_surge') THEN
    RAISE EXCEPTION 'Invalid lumen signal_type: %', NEW.signal_type;
  END IF;
  IF NEW.severity NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'Invalid lumen severity: %', NEW.severity;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_lumen_signal
  BEFORE INSERT OR UPDATE ON public.lumen_signals
  FOR EACH ROW EXECUTE FUNCTION public.validate_lumen_signal();

-- RLS
ALTER TABLE public.lumen_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read lumen signals"
  ON public.lumen_signals FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "Service insert lumen signals"
  ON public.lumen_signals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service update lumen signals"
  ON public.lumen_signals FOR UPDATE
  USING (true);

-- Extend operator_narrative_metrics
ALTER TABLE public.operator_narrative_metrics
  ADD COLUMN IF NOT EXISTS lumen_signal_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drift_risk_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expansion_ready_count int DEFAULT 0;
