-- Fix note_history INSERT policies to enforce created_by = auth.uid()

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Users can add contact notes" ON public.note_history;
DROP POLICY IF EXISTS "Users can add event notes" ON public.note_history;
DROP POLICY IF EXISTS "Users can add opportunity notes" ON public.note_history;

-- Recreate with created_by enforcement
CREATE POLICY "Users can add opportunity notes"
  ON public.note_history FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    entity_type = 'opportunity' AND (
      has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]) OR
      EXISTS (
        SELECT 1 FROM opportunities o 
        WHERE o.id = note_history.entity_id 
        AND has_metro_access(auth.uid(), o.metro_id)
      )
    )
  );

CREATE POLICY "Users can add event notes"
  ON public.note_history FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    entity_type = 'event' AND (
      has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]) OR
      EXISTS (
        SELECT 1 FROM events e 
        WHERE e.id = note_history.entity_id 
        AND has_metro_access(auth.uid(), e.metro_id)
      )
    )
  );

CREATE POLICY "Users can add contact notes"
  ON public.note_history FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    entity_type = 'contact' AND (
      has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]) OR
      EXISTS (
        SELECT 1 FROM contacts c
        JOIN opportunities o ON o.id = c.opportunity_id
        WHERE c.id = note_history.entity_id 
        AND has_metro_access(auth.uid(), o.metro_id)
      )
    )
  );

-- Move pg_cron and pg_net extensions to a dedicated schema
-- Note: These extensions may already be in their proper schemas managed by Supabase
-- We'll create an extensions schema if it doesn't exist and move what we can
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;