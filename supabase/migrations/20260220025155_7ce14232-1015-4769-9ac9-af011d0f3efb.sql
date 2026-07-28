-- Part 1: Add 9 operator-specific columns to opportunities table
-- Additive only, all nullable, no existing queries break

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS plan_tier text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS tenant_slug text,
  ADD COLUMN IF NOT EXISTS onboarding_state text,
  ADD COLUMN IF NOT EXISTS seats_allocated integer,
  ADD COLUMN IF NOT EXISTS seats_used integer,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_source text;