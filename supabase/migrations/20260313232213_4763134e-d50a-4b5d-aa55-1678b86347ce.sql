-- Add UPDATE policy for financial_events (needed for webhook status updates via client if ever needed)
CREATE POLICY "Tenant members can update financial events"
  ON public.financial_events
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- Add cleanup index for webhook idempotency table
CREATE INDEX IF NOT EXISTS idx_stripe_connect_webhook_processed ON public.stripe_connect_webhook_events(processed_at);