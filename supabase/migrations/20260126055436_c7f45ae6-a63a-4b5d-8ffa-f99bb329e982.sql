-- Fix: Require authentication to read partnership angles
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read partnership angles" ON public.partnership_angles;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view partnership angles" 
ON public.partnership_angles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);