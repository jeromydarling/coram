
-- Communio Resonance Engine — cross-tenant pattern signals
-- Stores aggregated resonance snapshots per archetype/metro for discovery augmentation.
-- No PII, no rankings, no popularity — just quiet pattern proximity.

CREATE TABLE public.communio_resonance_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  archetype_key text NOT NULL,
  metro_id uuid REFERENCES public.metros(id),
  search_type text NOT NULL,
  resonant_keywords text[] NOT NULL DEFAULT '{}',
  signal_count integer NOT NULL DEFAULT 0,
  tenant_count integer NOT NULL DEFAULT 0,
  testimonium_themes text[] NOT NULL DEFAULT '{}',
  communio_participation_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup during search
CREATE INDEX idx_resonance_archetype_metro ON public.communio_resonance_snapshots (archetype_key, metro_id, search_type);

-- Enable RLS
ALTER TABLE public.communio_resonance_snapshots ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users (aggregated, non-PII data)
CREATE POLICY "Authenticated users can read resonance snapshots"
  ON public.communio_resonance_snapshots
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role inserts (via edge function or n8n)
CREATE POLICY "Service role can manage resonance snapshots"
  ON public.communio_resonance_snapshots
  FOR ALL
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Validation trigger for search_type
CREATE OR REPLACE FUNCTION public.validate_resonance_snapshot()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.search_type NOT IN ('event', 'opportunity', 'people', 'grant') THEN
    RAISE EXCEPTION 'Invalid resonance snapshot search_type: %', NEW.search_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_resonance_snapshot
  BEFORE INSERT OR UPDATE ON public.communio_resonance_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.validate_resonance_snapshot();
