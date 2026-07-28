-- Add founding_garden_status to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS founding_garden_status boolean NOT NULL DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN public.tenants.founding_garden_status IS 'Whether this tenant is a Founding Garden early adopter member';