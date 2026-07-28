-- Add primary_contact_id to opportunities table to link to contacts
ALTER TABLE public.opportunities 
ADD COLUMN primary_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX idx_opportunities_primary_contact_id ON public.opportunities(primary_contact_id);