-- Add met_at_event_id column to contacts table
ALTER TABLE public.contacts
ADD COLUMN met_at_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_contacts_met_at_event ON public.contacts(met_at_event_id);