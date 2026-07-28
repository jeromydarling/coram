-- Fix 1: Restrict profiles to hide sensitive Google OAuth tokens from other users
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;

-- Create a view that excludes sensitive token fields for general access
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  display_name,
  timezone,
  google_calendar_enabled,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;

-- Fix 2: Tighten contacts RLS - restrict email/phone to owner or admin/leadership only
-- The current policy allows viewing for owned opportunities, which is correct
-- But we need to ensure unlinked contacts (opportunity_id IS NULL) are also protected

-- Drop existing policies to recreate with tighter restrictions
DROP POLICY IF EXISTS "Users can view contacts for owned opportunities" ON public.contacts;

-- Create new stricter SELECT policy - users can only see contacts for opportunities they own
-- Admin/leadership can see all, others need explicit ownership
CREATE POLICY "Users can view contacts for owned opportunities" 
ON public.contacts 
FOR SELECT 
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR (
    opportunity_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM opportunities o 
      WHERE o.id = contacts.opportunity_id 
      AND o.owner_id = auth.uid()
    )
  )
);

-- Note: Unlinked contacts (opportunity_id IS NULL) are now only visible to admin/leadership
-- This is more secure than allowing anyone to see orphaned contacts