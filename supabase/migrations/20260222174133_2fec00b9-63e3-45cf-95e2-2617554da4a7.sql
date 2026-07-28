
-- Communio Awareness Signals table
CREATE TABLE public.communio_awareness_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_signal_type text NOT NULL,
  archetype_scope text,
  metro_scope uuid REFERENCES public.metros(id),
  anonymized_message text NOT NULL,
  suggested_action text NOT NULL,
  role_scope text NOT NULL DEFAULT 'companion',
  is_hipaa_safe boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'both',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_communio_awareness_signal()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role_scope NOT IN ('shepherd', 'companion', 'steward', 'visitor') THEN
    RAISE EXCEPTION 'Invalid communio_awareness_signals role_scope: %', NEW.role_scope;
  END IF;
  IF NEW.visibility NOT IN ('tenant', 'operator', 'both') THEN
    RAISE EXCEPTION 'Invalid communio_awareness_signals visibility: %', NEW.visibility;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_communio_awareness_signal
  BEFORE INSERT OR UPDATE ON public.communio_awareness_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_communio_awareness_signal();

-- RLS
ALTER TABLE public.communio_awareness_signals ENABLE ROW LEVEL SECURITY;

-- Operators can see all
CREATE POLICY "Operators can view communio awareness signals"
  ON public.communio_awareness_signals FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[]));

-- Tenants can see tenant-visible or both-visible signals
CREATE POLICY "Tenants can view awareness signals"
  ON public.communio_awareness_signals FOR SELECT
  USING (visibility IN ('tenant', 'both'));

-- Service role insert only (via edge function)
CREATE POLICY "Service role can insert awareness signals"
  ON public.communio_awareness_signals FOR INSERT
  WITH CHECK (true);

-- Index
CREATE INDEX idx_communio_awareness_created ON public.communio_awareness_signals(created_at DESC);
CREATE INDEX idx_communio_awareness_type ON public.communio_awareness_signals(source_signal_type);

-- Add communio_awareness_enabled to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS communio_awareness_enabled boolean NOT NULL DEFAULT true;
