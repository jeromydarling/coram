-- Phase 25A: Add revelation window columns to providence_reports
ALTER TABLE public.providence_reports
  ADD COLUMN revelation_start TIMESTAMPTZ NULL,
  ADD COLUMN revelation_end TIMESTAMPTZ NULL,
  ADD COLUMN revelation_type TEXT NULL;

-- Validation trigger instead of CHECK constraint (time-safe)
CREATE OR REPLACE FUNCTION public.validate_providence_revelation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.revelation_type IS NOT NULL AND NEW.revelation_type NOT IN (
    'threshold_crossing', 're_emergence', 'first_activation', 'restorative_shift'
  ) THEN
    RAISE EXCEPTION 'Invalid revelation_type: %', NEW.revelation_type;
  END IF;
  -- If revelation_type is set, start/end must also be set
  IF NEW.revelation_type IS NOT NULL AND (NEW.revelation_start IS NULL OR NEW.revelation_end IS NULL) THEN
    RAISE EXCEPTION 'revelation_start and revelation_end required when revelation_type is set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_providence_revelation
  BEFORE INSERT OR UPDATE ON public.providence_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_providence_revelation();
