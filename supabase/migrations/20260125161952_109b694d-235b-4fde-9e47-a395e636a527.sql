-- Create note history table for tracking notes across entities
CREATE TABLE public.note_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('event', 'opportunity', 'contact')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_note_history_entity ON public.note_history(entity_type, entity_id);
CREATE INDEX idx_note_history_created_at ON public.note_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.note_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow viewing notes based on entity access
-- For events: check metro access
CREATE POLICY "Users can view event notes"
ON public.note_history
FOR SELECT
TO authenticated
USING (
  entity_type = 'event' AND (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = entity_id
      AND public.has_metro_access(auth.uid(), e.metro_id)
    )
  )
);

-- For opportunities: check metro access
CREATE POLICY "Users can view opportunity notes"
ON public.note_history
FOR SELECT
TO authenticated
USING (
  entity_type = 'opportunity' AND (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = entity_id
      AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  )
);

-- For contacts: check via opportunity metro access
CREATE POLICY "Users can view contact notes"
ON public.note_history
FOR SELECT
TO authenticated
USING (
  entity_type = 'contact' AND (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.opportunities o ON o.id = c.opportunity_id
      WHERE c.id = entity_id
      AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  )
);

-- Insert policies (same logic as select)
CREATE POLICY "Users can add event notes"
ON public.note_history
FOR INSERT
TO authenticated
WITH CHECK (
  entity_type = 'event' AND (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = entity_id
      AND public.has_metro_access(auth.uid(), e.metro_id)
    )
  )
);

CREATE POLICY "Users can add opportunity notes"
ON public.note_history
FOR INSERT
TO authenticated
WITH CHECK (
  entity_type = 'opportunity' AND (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = entity_id
      AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  )
);

CREATE POLICY "Users can add contact notes"
ON public.note_history
FOR INSERT
TO authenticated
WITH CHECK (
  entity_type = 'contact' AND (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.opportunities o ON o.id = c.opportunity_id
      WHERE c.id = entity_id
      AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  )
);

-- Delete policy: only admins or the note creator can delete
CREATE POLICY "Users can delete their own notes or admins any"
ON public.note_history
FOR DELETE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  OR created_by = auth.uid()
);