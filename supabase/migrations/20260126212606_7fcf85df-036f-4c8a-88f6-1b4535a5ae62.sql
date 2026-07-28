-- Add attendance tracking and contact linking to Google Calendar events
ALTER TABLE public.google_calendar_events 
ADD COLUMN attended boolean DEFAULT false;

ALTER TABLE public.google_calendar_events 
ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX idx_google_calendar_events_contact_id 
  ON public.google_calendar_events(contact_id);

COMMENT ON COLUMN public.google_calendar_events.attended IS 
  'Whether the user attended this Google Calendar meeting';

COMMENT ON COLUMN public.google_calendar_events.contact_id IS 
  'Optional link to a CRM contact for meeting history tracking';