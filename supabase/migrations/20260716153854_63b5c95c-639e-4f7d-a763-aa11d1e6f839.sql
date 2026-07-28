
CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS federation_app_slug cros_app_slug REFERENCES public.federation_apps(slug) ON DELETE SET NULL;

------------------------------------------------------------------
-- 1) gardener_tracked_campaigns
------------------------------------------------------------------
CREATE TABLE public.gardener_tracked_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  federation_app_slug cros_app_slug NOT NULL REFERENCES public.federation_apps(slug) ON DELETE RESTRICT,
  gardener_user_id uuid NOT NULL,
  tracking_enabled boolean NOT NULL DEFAULT true,
  disclose_pixel boolean NOT NULL DEFAULT true,
  csv_import_filename text,
  csv_row_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gardener_tracked_campaigns TO authenticated;
GRANT ALL ON public.gardener_tracked_campaigns TO service_role;

ALTER TABLE public.gardener_tracked_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage tracked campaigns"
  ON public.gardener_tracked_campaigns
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gtc_federation_app_slug ON public.gardener_tracked_campaigns(federation_app_slug);
CREATE INDEX idx_gtc_gardener_user_id ON public.gardener_tracked_campaigns(gardener_user_id);

------------------------------------------------------------------
-- 2) gardener_tracked_sends
------------------------------------------------------------------
CREATE TABLE public.gardener_tracked_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_campaign_id uuid NOT NULL REFERENCES public.gardener_tracked_campaigns(id) ON DELETE CASCADE,
  audience_id uuid REFERENCES public.email_campaign_audience(id) ON DELETE SET NULL,
  recipient_email citext NOT NULL,
  recipient_email_hash text NOT NULL,
  recipient_name text,
  recipient_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_message_id text,
  gmail_thread_id text,
  subject text,
  sent_at timestamptz,
  first_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  replied_at timestamptz,
  reply_snippet text,
  reply_from_recipient boolean,
  first_signup_at timestamptz,
  first_customer_at timestamptz,
  customer_plan text,
  customer_amount_cents integer,
  last_swept_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracked_campaign_id, recipient_email_hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gardener_tracked_sends TO authenticated;
GRANT ALL ON public.gardener_tracked_sends TO service_role;

ALTER TABLE public.gardener_tracked_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage tracked sends"
  ON public.gardener_tracked_sends
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gts_tracked_campaign_id ON public.gardener_tracked_sends(tracked_campaign_id);
CREATE INDEX idx_gts_recipient_email_hash ON public.gardener_tracked_sends(recipient_email_hash);
CREATE INDEX idx_gts_gmail_thread_id ON public.gardener_tracked_sends(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;
CREATE INDEX idx_gts_pending_reply ON public.gardener_tracked_sends(sent_at) WHERE replied_at IS NULL AND sent_at IS NOT NULL;
CREATE INDEX idx_gts_pending_signup ON public.gardener_tracked_sends(sent_at) WHERE first_signup_at IS NULL AND sent_at IS NOT NULL;

------------------------------------------------------------------
-- 3) gardener_tracked_events
------------------------------------------------------------------
CREATE TABLE public.gardener_tracked_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.gardener_tracked_sends(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('open','click','reply','signup','customer')),
  url text,
  user_agent text,
  ip inet,
  federation_app_slug cros_app_slug REFERENCES public.federation_apps(slug) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.gardener_tracked_events TO authenticated;
GRANT ALL ON public.gardener_tracked_events TO service_role;

ALTER TABLE public.gardener_tracked_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators view tracked events"
  ON public.gardener_tracked_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gte_send_id ON public.gardener_tracked_events(send_id);
CREATE INDEX idx_gte_event_type ON public.gardener_tracked_events(event_type);
CREATE INDEX idx_gte_occurred_at ON public.gardener_tracked_events(occurred_at DESC);

------------------------------------------------------------------
-- 4) gardener_federation_signup_orphans
------------------------------------------------------------------
CREATE TABLE public.gardener_federation_signup_orphans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  federation_app_slug cros_app_slug NOT NULL REFERENCES public.federation_apps(slug) ON DELETE CASCADE,
  email citext,
  email_hash text,
  external_user_id text,
  event_type text NOT NULL CHECK (event_type IN ('signup','customer')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (federation_app_slug, external_user_id, event_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gardener_federation_signup_orphans TO authenticated;
GRANT ALL ON public.gardener_federation_signup_orphans TO service_role;

ALTER TABLE public.gardener_federation_signup_orphans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage federation orphans"
  ON public.gardener_federation_signup_orphans
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gfso_federation_app_slug ON public.gardener_federation_signup_orphans(federation_app_slug);
CREATE INDEX idx_gfso_email_hash ON public.gardener_federation_signup_orphans(email_hash);

------------------------------------------------------------------
-- updated_at trigger fn (idempotent)
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gtc_updated_at
  BEFORE UPDATE ON public.gardener_tracked_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_gts_updated_at
  BEFORE UPDATE ON public.gardener_tracked_sends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
