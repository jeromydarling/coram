
-- Add operator-granted columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_operator_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS operator_grant_reason text,
  ADD COLUMN IF NOT EXISTS operator_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_granted_by uuid,
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'stripe';

-- Add check constraint for billing_mode
ALTER TABLE public.tenants
  ADD CONSTRAINT chk_billing_mode CHECK (billing_mode IN ('stripe', 'operator_granted', 'internal'));

-- Index for fast operator-granted lookups
CREATE INDEX IF NOT EXISTS idx_tenants_operator_granted ON public.tenants(is_operator_granted) WHERE is_operator_granted = true;
CREATE INDEX IF NOT EXISTS idx_tenants_billing_mode ON public.tenants(billing_mode);
