
-- Add is_tenant_partner flag to opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS is_tenant_partner boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_partner
  ON public.opportunities (is_tenant_partner) WHERE is_tenant_partner = true;
