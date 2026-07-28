-- Phase 21F: Operator Push + Analytics Observability

-- 1. Operator Notification Settings
CREATE TABLE IF NOT EXISTS public.operator_notification_settings (
  operator_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  daily_digest_time text NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'America/New_York',
  notify_on_error_spike boolean NOT NULL DEFAULT true,
  notify_on_critical_error boolean NOT NULL DEFAULT true,
  notify_on_draft_ready boolean NOT NULL DEFAULT true,
  notify_on_qa_fail boolean NOT NULL DEFAULT true,
  notify_on_activation_stuck boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage own settings"
  ON public.operator_notification_settings
  FOR ALL TO authenticated
  USING (operator_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (operator_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_operator_notif_settings_timestamp()
  RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_operator_notif_settings_updated
  BEFORE UPDATE ON public.operator_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_operator_notif_settings_timestamp();

-- 2. Operator Notifications
CREATE TABLE IF NOT EXISTS public.operator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'notice',
  title text NOT NULL,
  body text NOT NULL,
  deep_link text NULL,
  dedupe_key text NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for type and severity
CREATE OR REPLACE FUNCTION public.validate_operator_notification()
  RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('draft_ready','critical_error','error_spike','qa_failure','security_flag','activation_stuck','migration_failed','system_message') THEN
    RAISE EXCEPTION 'Invalid operator_notifications type: %', NEW.type;
  END IF;
  IF NEW.severity NOT IN ('info','notice','warning','critical') THEN
    RAISE EXCEPTION 'Invalid operator_notifications severity: %', NEW.severity;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_operator_notification
  BEFORE INSERT OR UPDATE ON public.operator_notifications
  FOR EACH ROW EXECUTE FUNCTION public.validate_operator_notification();

-- Unique partial index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_notif_dedupe
  ON public.operator_notifications (operator_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operator_notif_unread
  ON public.operator_notifications (operator_user_id, is_read, created_at DESC)
  WHERE is_read = false;

ALTER TABLE public.operator_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read own notifications"
  ON public.operator_notifications
  FOR ALL TO authenticated
  USING (operator_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (operator_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- 3. Operator Push Subscriptions
CREATE TABLE IF NOT EXISTS public.operator_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_push_unique
  ON public.operator_push_subscriptions (operator_user_id, endpoint);

ALTER TABLE public.operator_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage own push subscriptions"
  ON public.operator_push_subscriptions
  FOR ALL TO authenticated
  USING (operator_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (operator_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- 4. Operator Analytics Rollups
CREATE TABLE IF NOT EXISTS public.operator_analytics_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_rollup_day_key
  ON public.operator_analytics_rollups (day, metric_key);

ALTER TABLE public.operator_analytics_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read analytics rollups"
  ON public.operator_analytics_rollups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Operator Insight Notes (NRI Quiet Watch)
CREATE TABLE IF NOT EXISTS public.operator_insight_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  title text NOT NULL,
  narrative text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  deep_link text NULL,
  status text NOT NULL DEFAULT 'new'
);

CREATE OR REPLACE FUNCTION public.validate_operator_insight_note()
  RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('adoption_suggestion','ux_suggestion','funnel_suggestion') THEN
    RAISE EXCEPTION 'Invalid operator_insight_notes type: %', NEW.type;
  END IF;
  IF NEW.status NOT IN ('new','reviewed','dismissed','implemented') THEN
    RAISE EXCEPTION 'Invalid operator_insight_notes status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_operator_insight_note
  BEFORE INSERT OR UPDATE ON public.operator_insight_notes
  FOR EACH ROW EXECUTE FUNCTION public.validate_operator_insight_note();

ALTER TABLE public.operator_insight_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage insight notes"
  ON public.operator_insight_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));