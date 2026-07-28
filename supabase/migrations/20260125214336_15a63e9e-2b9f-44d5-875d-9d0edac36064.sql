-- Add contact_id to activities for direct contact linking (meetings)
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add Google Calendar sync fields to activities
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS google_calendar_event_id text,
ADD COLUMN IF NOT EXISTS google_calendar_synced_at timestamp with time zone;

-- Add Google Calendar sync fields to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS google_calendar_event_id text,
ADD COLUMN IF NOT EXISTS google_calendar_synced_at timestamp with time zone;

-- Add Google OAuth fields to profiles for calendar sync
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_calendar_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_refresh_token text,
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_token_expires_at timestamp with time zone;

-- Create indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_activities_activity_date_time ON public.activities(activity_date_time);
CREATE INDEX IF NOT EXISTS idx_activities_google_calendar_event_id ON public.activities(google_calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_google_calendar_event_id ON public.events(google_calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id);