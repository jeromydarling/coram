
-- ============================================================================
-- Notification Events: all emitted notification events (the "inbox")
-- ============================================================================
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,  -- watchlist_signal, campaign_suggestion_ready, event_enrichment_ready, campaign_send_summary, automation_failed
  org_id uuid,
  user_id uuid,  -- target user; NULL for broadcast (e.g. admin alerts resolve at dispatch time)
  metadata jsonb DEFAULT '{}'::jsonb,
  priority text NOT NULL DEFAULT 'normal', -- low, normal, high
  fingerprint text NOT NULL,
  tier text NOT NULL DEFAULT 'T1', -- T1, T2, T3
  deep_link text,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, bundled, delivered, dropped, queued_quiet
  bundle_key text, -- grouping key for T2 bundling: user_id + org_id or user_id + event_type
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  bundle_id uuid  -- links bundled events to a single delivery
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- Service role writes; users can read their own
CREATE POLICY "Service role manages notification events"
  ON public.notification_events FOR ALL
  USING (true) WITH CHECK (true);

-- Users can read their own events
CREATE POLICY "Users read own notification events"
  ON public.notification_events FOR SELECT
  USING (user_id = auth.uid());

-- Dedupe index: same user + fingerprint = one event
CREATE UNIQUE INDEX uq_notification_events_dedupe 
  ON public.notification_events (user_id, fingerprint);

-- For dispatcher queries
CREATE INDEX idx_notification_events_pending 
  ON public.notification_events (status, created_at) 
  WHERE status IN ('pending', 'queued_quiet');

CREATE INDEX idx_notification_events_bundle 
  ON public.notification_events (bundle_key, status, created_at)
  WHERE status = 'pending';

-- ============================================================================
-- Notification Deliveries: actual push sends
-- ============================================================================
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.notification_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed, skipped
  sent_at timestamptz,
  error text,
  push_subscription_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages notification deliveries"
  ON public.notification_deliveries FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Users read own deliveries"
  ON public.notification_deliveries FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX idx_notification_deliveries_user 
  ON public.notification_deliveries (user_id, created_at DESC);

-- ============================================================================
-- Notification Queue: for T2 bundled / quiet-hour-queued items
-- ============================================================================
CREATE TABLE public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_ids uuid[] NOT NULL DEFAULT '{}',
  bundle_key text NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  priority text NOT NULL DEFAULT 'normal',
  deliver_after timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending', -- pending, processing, delivered, failed
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages notification queue"
  ON public.notification_queue FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_notification_queue_pending 
  ON public.notification_queue (status, deliver_after)
  WHERE status = 'pending';

-- ============================================================================
-- Notification Type Toggles: admin kill switches per notification type
-- ============================================================================
CREATE TABLE public.notification_type_config (
  event_type text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  default_on boolean NOT NULL DEFAULT true,
  admin_only boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_type_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notification type config"
  ON public.notification_type_config FOR SELECT
  USING (true);

CREATE POLICY "Admins manage notification type config"
  ON public.notification_type_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the in-scope notification types
INSERT INTO public.notification_type_config (event_type, enabled, default_on, admin_only, description) VALUES
  ('watchlist_signal', true, true, false, 'Website change signals from monitored organizations'),
  ('campaign_suggestion_ready', true, true, false, 'New outreach suggestions ready for review'),
  ('event_enrichment_ready', true, true, false, 'Event attendee enrichment completed with matches'),
  ('campaign_send_summary', true, false, false, 'Gmail campaign send summary (opt-in)'),
  ('automation_failed', true, true, true, 'Workflow/automation failure alerts (admin/leadership only)');

-- ============================================================================
-- Extend user_notification_settings with new per-type toggles + quiet hours
-- ============================================================================
ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS notify_watchlist_signals boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_campaign_suggestions boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_event_enrichment boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_campaign_summary boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_automation_health boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start integer DEFAULT 21,  -- 9pm local
  ADD COLUMN IF NOT EXISTS quiet_hours_end integer DEFAULT 8,     -- 8am local
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_daily_digest boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly_summary boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hourly_push_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_push_reset_at timestamptz DEFAULT now();

-- ============================================================================
-- Rate limit tracking function for hourly caps
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_notification_hourly_cap(
  p_user_id uuid,
  p_soft_cap integer DEFAULT 6,
  p_hard_cap integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings record;
  v_current_hour timestamptz;
  v_count integer;
BEGIN
  v_current_hour := date_trunc('hour', now());
  
  SELECT hourly_push_count, hourly_push_reset_at
  INTO v_settings
  FROM user_notification_settings
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'soft_exceeded', false, 'hard_exceeded', false, 'count', 0);
  END IF;
  
  -- Reset if we're in a new hour
  IF v_settings.hourly_push_reset_at IS NULL OR v_settings.hourly_push_reset_at < v_current_hour THEN
    UPDATE user_notification_settings
    SET hourly_push_count = 0, hourly_push_reset_at = v_current_hour
    WHERE user_id = p_user_id;
    v_count := 0;
  ELSE
    v_count := COALESCE(v_settings.hourly_push_count, 0);
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_count < p_hard_cap,
    'soft_exceeded', v_count >= p_soft_cap,
    'hard_exceeded', v_count >= p_hard_cap,
    'count', v_count
  );
END;
$$;

-- ============================================================================
-- Increment hourly push count
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_notification_push_count(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE user_notification_settings
  SET hourly_push_count = hourly_push_count + 1
  WHERE user_id = p_user_id;
END;
$$;
