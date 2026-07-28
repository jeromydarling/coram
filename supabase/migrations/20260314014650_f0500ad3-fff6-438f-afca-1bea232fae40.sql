-- Update stripe_catalog_cache with live CROS LLC price IDs
INSERT INTO public.stripe_catalog_cache (lookup_key, price_id, product_id, active) VALUES
  ('cros_core', 'price_1TAh8YIuo9wd3dMdDsWk0zXv', 'prod_U8z6jlvVhKv9qZ', true),
  ('cros_insight', 'price_1TAh8ZIuo9wd3dMdXAIoOK9R', 'prod_U8z6LGUkXDJpx2', true),
  ('cros_story', 'price_1TAh8bIuo9wd3dMd4YKAeOoK', 'prod_U8z6GphHgzYNTO', true),
  ('cros_bridge', 'price_1TAh8cIuo9wd3dMdLjH7qASI', 'prod_U8z6Mc849SLYzz', true),
  ('cros_addon_additional_users', 'price_1TAh8dIuo9wd3dMdIFYzeUI6', 'prod_U8z6AcbAKtOtgW', true),
  ('cros_addon_capacity_25', 'price_1TAh8fIuo9wd3dMd6jHf5xR4', 'prod_U8z6LscJnGCo2o', true),
  ('cros_addon_capacity_75', 'price_1TAh8gIuo9wd3dMdXqcnBkuz', 'prod_U8z6Kxoi1huUdx', true),
  ('cros_addon_capacity_200', 'price_1TAh8iIuo9wd3dMd6hCL1yrn', 'prod_U8z6mFGK3qHILi', true),
  ('cros_addon_campaigns', 'price_1TAh8jIuo9wd3dMdm1801HLv', 'prod_U8z6shptP92O13', true),
  ('cros_addon_expansion_capacity', 'price_1TAh8kIuo9wd3dMdJs8QxN9A', 'prod_U8z6SZSAN3c5aH', true)
ON CONFLICT (lookup_key) DO UPDATE SET
  price_id = EXCLUDED.price_id,
  product_id = EXCLUDED.product_id,
  active = EXCLUDED.active;

-- Deactivate old sandbox-only add-ons that no longer exist
UPDATE public.stripe_catalog_cache SET active = false
WHERE lookup_key IN ('cros_addon_expanded_ai', 'cros_addon_expanded_local_pulse', 'cros_addon_advanced_nri');