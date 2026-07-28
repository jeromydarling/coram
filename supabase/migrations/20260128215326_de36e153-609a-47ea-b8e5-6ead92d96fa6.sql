-- Add policy to allow service role to update email communications
-- This is needed for re-matching previously synced emails to newly added contacts
CREATE POLICY "Service role can update email communications"
ON public.email_communications
FOR UPDATE
USING (true)
WITH CHECK (true);