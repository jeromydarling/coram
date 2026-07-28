
-- Add applied_indices and dismissed_at to contact_suggestions
ALTER TABLE public.contact_suggestions 
  ADD COLUMN IF NOT EXISTS applied_indices int[] NOT NULL DEFAULT '{}'::int[];

ALTER TABLE public.contact_suggestions 
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz NULL;
