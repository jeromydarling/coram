
-- 1. Add 'Visit' to activity_type enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Visit';

-- 2. Add dual-link and on-behalf-of columns to voice_notes
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS author_volunteer_id uuid REFERENCES public.volunteers(id),
  ADD COLUMN IF NOT EXISTS recorded_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS recording_mode text NOT NULL DEFAULT 'self';

-- 3. Validation trigger for recording_mode
CREATE OR REPLACE FUNCTION public.validate_voice_note_recording_mode()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.recording_mode NOT IN ('self', 'on_behalf_of', 'email_ingested') THEN
    RAISE EXCEPTION 'Invalid voice_notes recording_mode: %', NEW.recording_mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_voice_note_recording_mode
  BEFORE INSERT OR UPDATE ON public.voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_voice_note_recording_mode();

-- 4. Index for contact-anchored queries (person timeline)
CREATE INDEX IF NOT EXISTS idx_voice_notes_contact_id ON public.voice_notes(contact_id) WHERE contact_id IS NOT NULL;

-- 5. Index for volunteer-authored queries
CREATE INDEX IF NOT EXISTS idx_voice_notes_author_volunteer ON public.voice_notes(author_volunteer_id) WHERE author_volunteer_id IS NOT NULL;
