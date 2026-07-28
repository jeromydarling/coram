
-- Create user_alerts table
CREATE TABLE public.user_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Dedup index: one unread alert per user+ref
CREATE UNIQUE INDEX uq_user_alerts_unread
  ON public.user_alerts (user_id, ref_id)
  WHERE read_at IS NULL;

-- Lookup index
CREATE INDEX idx_user_alerts_user_unread
  ON public.user_alerts (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

-- Users can read their own alerts
CREATE POLICY "Users can view own alerts"
  ON public.user_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own alerts
CREATE POLICY "Users can update own alerts"
  ON public.user_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role inserts (from edge functions / triggers)
CREATE POLICY "Service role can insert alerts"
  ON public.user_alerts FOR INSERT
  WITH CHECK (true);
