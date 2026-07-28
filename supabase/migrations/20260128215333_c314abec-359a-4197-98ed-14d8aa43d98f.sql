-- Drop the overly permissive policy since service role bypasses RLS anyway
DROP POLICY IF EXISTS "Service role can update email communications" ON public.email_communications;

-- Instead, add a policy that allows users to update their own email communications
-- This is safer and still allows the edge function (service role) to update
CREATE POLICY "Users can update own email communications"
ON public.email_communications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);