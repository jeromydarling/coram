
-- Allow tenant-less QA runs (e.g. checkout E2E that creates its own tenant)
ALTER TABLE public.qa_test_runs ALTER COLUMN tenant_id DROP NOT NULL;

-- Add requires_tenant flag to suites so the UI knows which need a tenant selected
ALTER TABLE public.qa_test_suites ADD COLUMN IF NOT EXISTS requires_tenant boolean NOT NULL DEFAULT true;

-- Mark checkout E2E as not requiring a tenant
UPDATE public.qa_test_suites SET requires_tenant = false WHERE key = '80_checkout_e2e';
