
-- Add default_gl_account column if not present
ALTER TABLE public.provision_catalog_items
  ADD COLUMN IF NOT EXISTS default_gl_account text;

-- Add indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_catalog_items_active
  ON public.provision_catalog_items (active);

CREATE INDEX IF NOT EXISTS idx_catalog_items_cat_tier_name
  ON public.provision_catalog_items (category, tier, name);

CREATE INDEX IF NOT EXISTS idx_catalog_items_updated_at
  ON public.provision_catalog_items (updated_at DESC);
