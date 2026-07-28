
-- Phase 5B Hardening: Add extraction_status, date_confidence, needs_review to events
-- Also make event_date nullable for low-confidence recurring events

ALTER TABLE public.events ALTER COLUMN event_date DROP NOT NULL;

ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS date_confidence text NOT NULL DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- Add check constraints via triggers (not CHECK) per guidelines
CREATE OR REPLACE FUNCTION public.validate_event_extraction_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.extraction_status NOT IN ('pending', 'complete', 'failed') THEN
    RAISE EXCEPTION 'Invalid extraction_status: %', NEW.extraction_status;
  END IF;
  IF NEW.date_confidence NOT IN ('high', 'low') THEN
    RAISE EXCEPTION 'Invalid date_confidence: %', NEW.date_confidence;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_event_extraction_fields
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_event_extraction_status();

-- Add validation trigger: attended_by must be set when attended=true
CREATE OR REPLACE FUNCTION public.validate_event_attendance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.attended = true AND NEW.attended_by IS NULL THEN
    RAISE EXCEPTION 'attended_by must be set when attended is true';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_event_attendance_ownership
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_event_attendance();

-- Index for extraction pipeline batch processing
CREATE INDEX IF NOT EXISTS idx_events_extraction_pending 
  ON public.events (extraction_status, metro_id) 
  WHERE extraction_status = 'pending';

-- Index for needs_review filter
CREATE INDEX IF NOT EXISTS idx_events_needs_review
  ON public.events (metro_id, needs_review)
  WHERE needs_review = true;
