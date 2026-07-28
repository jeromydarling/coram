-- Add website_url to ai_suggestions so chat-created opportunity suggestions can carry the URL
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS website_url text;

COMMENT ON COLUMN public.ai_suggestions.website_url IS 'Website URL for new_opportunity suggestions, used for auto-enrichment on approval';