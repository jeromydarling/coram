-- Create event_attendees table
CREATE TABLE public.event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  raw_full_name text NOT NULL,
  raw_org text,
  raw_title text,
  raw_email text,
  raw_phone text,
  linkedin_url text,
  tags jsonb DEFAULT '[]'::jsonb,
  match_status text NOT NULL DEFAULT 'unmatched' 
    CHECK (match_status IN ('matched', 'possible', 'new', 'unmatched', 'dismissed')),
  matched_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  matched_opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  confidence_score numeric(3,2) DEFAULT 0,
  target_score integer DEFAULT 0,
  target_reasons jsonb DEFAULT '[]'::jsonb,
  is_target boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_event_attendees_event ON public.event_attendees (event_id);
CREATE INDEX idx_event_attendees_match_status ON public.event_attendees (event_id, match_status);
CREATE INDEX idx_event_attendees_targets ON public.event_attendees (event_id, is_target, target_score DESC);
CREATE INDEX idx_event_attendees_email ON public.event_attendees (event_id, raw_email);

-- Trigger for updated_at
CREATE TRIGGER set_event_attendees_updated_at
  BEFORE UPDATE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- SELECT: Only if user can access the event's metro
CREATE POLICY "Users can view attendees for accessible events" 
  ON public.event_attendees FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_attendees.event_id 
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]) 
      OR public.has_metro_access(auth.uid(), e.metro_id)
    )
  ));

-- INSERT: Same metro access check
CREATE POLICY "Users can insert attendees for accessible events" 
  ON public.event_attendees FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_attendees.event_id 
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]) 
      OR public.has_metro_access(auth.uid(), e.metro_id)
    )
  ));

-- UPDATE: Same metro access check
CREATE POLICY "Users can update attendees for accessible events" 
  ON public.event_attendees FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_attendees.event_id 
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]) 
      OR public.has_metro_access(auth.uid(), e.metro_id)
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_attendees.event_id 
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]) 
      OR public.has_metro_access(auth.uid(), e.metro_id)
    )
  ));

-- DELETE: Same metro access check
CREATE POLICY "Users can delete attendees for accessible events" 
  ON public.event_attendees FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_attendees.event_id 
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]) 
      OR public.has_metro_access(auth.uid(), e.metro_id)
    )
  ));

-- Add conference columns to events table
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS is_conference boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS conference_plan_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conference_plan_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendee_count integer DEFAULT 0;