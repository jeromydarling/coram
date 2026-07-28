-- ============================================================================
-- 20260608210000_stripe_connect_webhook_columns.sql
--
-- Adds the columns the stripe-connect-webhook function writes when a Stripe
-- payout to a connected account fails, and drops the unused federation-level
-- revenue-share column from federation_apps.
--
-- WHY: The webhook now handles charge.refunded, application_fee.refunded,
--      charge.dispute.*, and payout.failed events. payout.failed records the
--      failure on tenant_stripe_connect so the operator dashboard can surface
--      it. The federation_apps.connect_revenue_share_pct column was never
--      read or written by any code path — splits are stored on
--      tenant_stripe_connect.platform_fee_percent instead.
-- ============================================================================

-- 1. Payout-failure columns on tenant_stripe_connect ------------------------
ALTER TABLE public.tenant_stripe_connect
  ADD COLUMN IF NOT EXISTS last_payout_failure_code    text,
  ADD COLUMN IF NOT EXISTS last_payout_failure_message text,
  ADD COLUMN IF NOT EXISTS last_payout_failure_at      timestamptz;

COMMENT ON COLUMN public.tenant_stripe_connect.last_payout_failure_code IS
  'Stripe failure_code from the most recent payout.failed webhook event.';
COMMENT ON COLUMN public.tenant_stripe_connect.last_payout_failure_message IS
  'Human-readable failure_message from the most recent payout.failed event.';
COMMENT ON COLUMN public.tenant_stripe_connect.last_payout_failure_at IS
  'When the most recent payout.failed event was received. Null = no failures.';

-- 2. Drop the unused federation_apps.connect_revenue_share_pct column ------
-- Splits live on tenant_stripe_connect.platform_fee_percent (tenant-scoped).
-- The federation-app-level column was added in phase 0 but never wired in.
ALTER TABLE public.federation_apps
  DROP COLUMN IF EXISTS connect_revenue_share_pct;
