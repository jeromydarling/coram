
-- Add campaigns_enabled to tenant_entitlements
ALTER TABLE public.tenant_entitlements
  ADD COLUMN IF NOT EXISTS campaigns_enabled boolean NOT NULL DEFAULT false;

-- Update stripe_catalog_cache with campaigns addon
INSERT INTO public.stripe_catalog_cache (lookup_key, price_id, product_id, active)
VALUES ('cros_addon_campaigns', 'price_1T2uqQRwrJkY2JxXusi9ifgj', 'prod_U0wjKIUakTmgTL', true)
ON CONFLICT (lookup_key) DO UPDATE SET price_id = EXCLUDED.price_id, product_id = EXCLUDED.product_id, active = EXCLUDED.active;
