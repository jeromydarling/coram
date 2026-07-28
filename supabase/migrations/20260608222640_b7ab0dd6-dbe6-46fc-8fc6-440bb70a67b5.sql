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

ALTER TABLE public.federation_apps
  DROP COLUMN IF EXISTS connect_revenue_share_pct;