-- Vendor credit snapshots for reconciliation against actual billing
CREATE TABLE public.vendor_credit_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vendor_remaining NUMERIC,
  vendor_total NUMERIC,
  vendor_used NUMERIC,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_credit_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view vendor credit snapshots"
  ON public.vendor_credit_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE INDEX idx_vendor_credit_snapshots_vendor_time
  ON public.vendor_credit_snapshots (vendor, snapshot_at DESC);