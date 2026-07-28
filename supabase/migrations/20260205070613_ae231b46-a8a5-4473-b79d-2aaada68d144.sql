-- Phase 1: Gmail Campaigns Migration
-- 1.1 Add gmail_email_address to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gmail_email_address text;

-- 1.2 Drop Brevo columns from email_campaigns
ALTER TABLE public.email_campaigns 
DROP COLUMN IF EXISTS brevo_list_id,
DROP COLUMN IF EXISTS brevo_campaign_id;

-- 1.3 Enforce Server-Write-Only on email_campaign_audience
-- Drop any existing INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "email_campaign_audience_insert_own_campaign" ON public.email_campaign_audience;
DROP POLICY IF EXISTS "email_campaign_audience_update_own_campaign" ON public.email_campaign_audience;
DROP POLICY IF EXISTS "email_campaign_audience_delete_own_campaign" ON public.email_campaign_audience;
DROP POLICY IF EXISTS "Users can insert audience for own campaigns" ON public.email_campaign_audience;
DROP POLICY IF EXISTS "Users can update audience for own campaigns" ON public.email_campaign_audience;
DROP POLICY IF EXISTS "Users can delete audience for own campaigns" ON public.email_campaign_audience;

-- Ensure SELECT policy exists (should already be there)
DROP POLICY IF EXISTS "email_campaign_audience_select_own_campaign" ON public.email_campaign_audience;
CREATE POLICY "email_campaign_audience_select_own_campaign"
ON public.email_campaign_audience
FOR SELECT
USING (
  public.can_access_email_features(auth.uid())
  AND public.owns_campaign(auth.uid(), campaign_id)
);

-- 1.4 Confirm email_campaign_events is SELECT-only
-- Drop any write policies that might exist
DROP POLICY IF EXISTS "email_campaign_events_insert_own_campaign" ON public.email_campaign_events;
DROP POLICY IF EXISTS "email_campaign_events_update_own_campaign" ON public.email_campaign_events;
DROP POLICY IF EXISTS "email_campaign_events_delete_own_campaign" ON public.email_campaign_events;
DROP POLICY IF EXISTS "Users can insert events for own campaigns" ON public.email_campaign_events;
DROP POLICY IF EXISTS "Users can update events for own campaigns" ON public.email_campaign_events;
DROP POLICY IF EXISTS "Users can delete events for own campaigns" ON public.email_campaign_events;

-- Ensure SELECT policy exists
DROP POLICY IF EXISTS "email_campaign_events_select_own_campaign" ON public.email_campaign_events;
CREATE POLICY "email_campaign_events_select_own_campaign"
ON public.email_campaign_events
FOR SELECT
USING (
  public.can_access_email_features(auth.uid())
  AND public.owns_campaign(auth.uid(), campaign_id)
);