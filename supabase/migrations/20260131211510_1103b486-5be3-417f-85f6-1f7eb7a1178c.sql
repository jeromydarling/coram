-- Add foreign key constraint for ai_suggestions.linked_contact_id
-- This enables Supabase's auto-join syntax for fetching related contact/opportunity data

ALTER TABLE public.ai_suggestions
ADD CONSTRAINT ai_suggestions_linked_contact_id_fkey
FOREIGN KEY (linked_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;