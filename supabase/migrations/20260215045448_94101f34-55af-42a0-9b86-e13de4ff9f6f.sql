
-- Add hidden flag to google_calendar_events
ALTER TABLE public.google_calendar_events 
ADD COLUMN hidden boolean NOT NULL DEFAULT false;

-- Index for efficient filtering
CREATE INDEX idx_google_calendar_events_hidden 
ON public.google_calendar_events (hidden) 
WHERE hidden = false;
