-- Add missing index for contact lookups
CREATE INDEX IF NOT EXISTS idx_event_attendees_matched_contact 
  ON public.event_attendees (matched_contact_id);