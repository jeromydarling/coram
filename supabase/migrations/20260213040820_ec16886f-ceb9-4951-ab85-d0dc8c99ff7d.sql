
-- Add source_url column to grants table
ALTER TABLE public.grants ADD COLUMN source_url text;

-- Add a comment for clarity
COMMENT ON COLUMN public.grants.source_url IS 'URL of the grant source page, captured from discovery search';
