
-- Discovery signals: community-shaped discernment signals on search results
-- Tenants signal relevance/noise without scores or rankings
CREATE TABLE public.discovery_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  search_result_id uuid NOT NULL REFERENCES public.search_results(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  content_key text,
  search_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for signal_type
CREATE OR REPLACE FUNCTION public.validate_discovery_signal_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.signal_type NOT IN ('relevance', 'curiosity', 'noise', 'alignment') THEN
    RAISE EXCEPTION 'Invalid discovery_signals signal_type: %', NEW.signal_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_discovery_signal_type
BEFORE INSERT OR UPDATE ON public.discovery_signals
FOR EACH ROW EXECUTE FUNCTION public.validate_discovery_signal_type();

-- One signal per type per user per result (upsert-friendly)
CREATE UNIQUE INDEX uq_discovery_signal_per_user
ON public.discovery_signals (user_id, search_result_id, signal_type);

-- Index for aggregation queries by tenant/archetype
CREATE INDEX idx_discovery_signals_tenant ON public.discovery_signals (tenant_id, signal_type);
CREATE INDEX idx_discovery_signals_search_type ON public.discovery_signals (search_type, signal_type);

-- RLS
ALTER TABLE public.discovery_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own signals"
ON public.discovery_signals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own signals"
ON public.discovery_signals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signals"
ON public.discovery_signals FOR DELETE
USING (auth.uid() = user_id);
