-- Add partner_tiers array column for multi-select (keeping partner_tier for backward compatibility during migration)
ALTER TABLE public.opportunities 
ADD COLUMN partner_tiers TEXT[] DEFAULT ARRAY['Other']::TEXT[];

-- Migrate existing data: convert single partner_tier to array
UPDATE public.opportunities 
SET partner_tiers = ARRAY[COALESCE(partner_tier::TEXT, 'Other')];

-- Add comment explaining the column
COMMENT ON COLUMN public.opportunities.partner_tiers IS 'Array of partner tier categories. Replaces single partner_tier column to allow organizations to have multiple sector classifications.';