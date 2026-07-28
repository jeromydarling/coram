-- Create table for external Google Calendar events
CREATE TABLE public.google_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_event_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  is_all_day boolean DEFAULT false,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, google_event_id)
);

-- Create table for attendees of external events
CREATE TABLE public.google_calendar_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id uuid NOT NULL REFERENCES public.google_calendar_events(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  response_status text,
  is_organizer boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(google_event_id, email)
);

-- Enable RLS
ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_attendees ENABLE ROW LEVEL SECURITY;

-- RLS policies for google_calendar_events
CREATE POLICY "Users can view their own external events"
  ON public.google_calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own external events"
  ON public.google_calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own external events"
  ON public.google_calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external events"
  ON public.google_calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for google_calendar_attendees (use explicit table alias)
CREATE POLICY "Users can view attendees for their events"
  ON public.google_calendar_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.google_calendar_events gce
      WHERE gce.id = google_calendar_attendees.google_event_id AND gce.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attendees for their events"
  ON public.google_calendar_attendees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.google_calendar_events gce
      WHERE gce.id = google_calendar_attendees.google_event_id AND gce.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update attendees for their events"
  ON public.google_calendar_attendees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.google_calendar_events gce
      WHERE gce.id = google_calendar_attendees.google_event_id AND gce.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attendees for their events"
  ON public.google_calendar_attendees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.google_calendar_events gce
      WHERE gce.id = google_calendar_attendees.google_event_id AND gce.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_google_calendar_events_user ON public.google_calendar_events(user_id);
CREATE INDEX idx_google_calendar_events_start_time ON public.google_calendar_events(start_time);
CREATE INDEX idx_google_calendar_attendees_event ON public.google_calendar_attendees(google_event_id);
CREATE INDEX idx_google_calendar_attendees_email ON public.google_calendar_attendees(email);