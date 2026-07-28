-- Add spec_path and updated_at columns to qa_test_suites
ALTER TABLE public.qa_test_suites 
  ADD COLUMN IF NOT EXISTS spec_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Upsert all known suites from the repo
INSERT INTO public.qa_test_suites (key, name, description, spec_path, enabled) VALUES
  ('core_smoke_v1', 'Core Smoke Test', 'Login, dashboard, opportunities, reflection, events, provisions, logout', 'tests/core-smoke.spec.ts', true),
  ('login_redirects_after_auth', 'Login Redirects After Auth', 'Verifies post-login redirect behavior', 'tests/login-redirects-after-auth.spec.ts', true),
  ('opportunities_list_loads', 'Opportunities List Loads', 'Verifies opportunities list page loads correctly', 'tests/opportunities-list-loads.spec.ts', true),
  ('pricing_to_stripe_redirect', 'Pricing to Stripe Redirect', 'Verifies pricing page redirects to Stripe checkout', 'tests/pricing-to-stripe-redirect.spec.ts', true),
  ('sidebar_navigation', 'Sidebar Navigation', 'Verifies sidebar nav groups expand and links navigate', 'tests/sidebar-navigation.spec.ts', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  spec_path = EXCLUDED.spec_path,
  updated_at = now();