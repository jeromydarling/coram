
-- Add missing columns to email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

-- Add new statuses to the enum
ALTER TYPE public.email_campaign_status ADD VALUE IF NOT EXISTS 'audience_ready';
ALTER TYPE public.email_campaign_status ADD VALUE IF NOT EXISTS 'paused';

-- Add missing columns to email_campaign_audience
ALTER TABLE public.email_campaign_audience
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS error_message text NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS provider_message_id text NULL,
  ADD COLUMN IF NOT EXISTS fingerprint text NULL;

-- Add unique constraint for dedup (campaign_id + email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_audience_fingerprint
  ON public.email_campaign_audience (campaign_id, email);

-- Add audience_id to email_campaign_events
ALTER TABLE public.email_campaign_events
  ADD COLUMN IF NOT EXISTS audience_id uuid NULL REFERENCES public.email_campaign_audience(id) ON DELETE SET NULL;

-- Add INSERT/UPDATE/DELETE policies for email_campaign_audience (service role writes, user reads)
-- Audience INSERT/UPDATE/DELETE is done via service role in edge functions, 
-- but we need policies for the service role client (which bypasses RLS).
-- The existing SELECT policy is sufficient for the client.

-- Add INSERT policy for email_campaign_events (service role)  
-- Events are written by edge functions via service role; SELECT policy already exists.
