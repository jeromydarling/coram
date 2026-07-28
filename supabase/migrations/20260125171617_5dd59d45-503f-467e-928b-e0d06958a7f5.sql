-- Add policy allowing authenticated users to view display names for collaboration
-- This enables features like seeing who owns an opportunity or who made updates
CREATE POLICY "Authenticated users can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add comment explaining the policy
COMMENT ON POLICY "Authenticated users can view basic profile info" ON public.profiles IS 
'Allows all authenticated users to view profile display_name for collaboration features like opportunity ownership and audit log attribution. User-specific sensitive data should be handled at application level if needed.';