-- Prevent duplicate CRM Meeting activities for the same Google Calendar event
-- (Partial unique index so other activity types or NULL ids are unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS activities_meeting_google_event_unique
ON public.activities (google_calendar_event_id)
WHERE activity_type = 'Meeting' AND google_calendar_event_id IS NOT NULL;