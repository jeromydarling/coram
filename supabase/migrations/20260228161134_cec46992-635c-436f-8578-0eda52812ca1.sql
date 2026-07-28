
-- Add created_by to entity_richness_overrides for auditability
ALTER TABLE public.entity_richness_overrides
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update existing rows to null (no backfill needed)
