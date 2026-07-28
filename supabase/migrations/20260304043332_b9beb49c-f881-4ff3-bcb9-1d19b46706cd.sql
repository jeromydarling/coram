INSERT INTO billing_products (tier, stripe_product_id, stripe_price_id, base_price_cents, billing_interval, included_users, included_usage)
VALUES
  ('core', 'prod_U5Hgv3sWJ7AOZy', 'price_1T7777RwrJkY2JxX9LNaJhcR', 4900, 'month', 10, '{"ai_calls": 200, "ai_tokens": 500000, "pulse_runs": 4}'::jsonb),
  ('insight', 'prod_U5Hg2ZCJ38fIlU', 'price_1T7778RwrJkY2JxXcpaMRIjq', 3900, 'month', 25, '{"ai_calls": 600, "ai_tokens": 1500000, "pulse_runs": 30}'::jsonb),
  ('story', 'prod_U5HgdYh1cNPYuV', 'price_1T7779RwrJkY2JxXUVgWhGzo', 2900, 'month', 50, '{"ai_calls": 600, "ai_tokens": 1500000, "pulse_runs": 30}'::jsonb)
ON CONFLICT DO NOTHING;