-- Add DELETE policy for email_campaign_audience table
CREATE POLICY "email_campaign_audience_delete_own_campaign"
ON public.email_campaign_audience
FOR DELETE
USING (can_access_email_features(auth.uid()) AND owns_campaign(auth.uid(), campaign_id));

-- Also add INSERT and UPDATE policies if they're missing
CREATE POLICY "email_campaign_audience_insert_own_campaign"
ON public.email_campaign_audience
FOR INSERT
WITH CHECK (can_access_email_features(auth.uid()) AND owns_campaign(auth.uid(), campaign_id));

CREATE POLICY "email_campaign_audience_update_own_campaign"
ON public.email_campaign_audience
FOR UPDATE
USING (can_access_email_features(auth.uid()) AND owns_campaign(auth.uid(), campaign_id));