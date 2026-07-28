-- Create oauth_states table for secure OAuth state management
CREATE TABLE public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  origin text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Only the service role (edge function) should access this table
-- No user-facing policies - this is a server-side only table
CREATE POLICY "Service role only" ON public.oauth_states
  FOR ALL USING (false);

-- Create index for fast lookups
CREATE INDEX idx_oauth_states_token ON public.oauth_states(token);
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- Update contacts RLS policy to require metro access even for unlinked contacts
-- First, drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view contacts for owned opportunities" ON public.contacts;

-- Create new policy that requires admin/leadership OR opportunity ownership
-- Contacts without an opportunity are only visible to admins/leadership
CREATE POLICY "Users can view contacts for owned opportunities" ON public.contacts
  FOR SELECT USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR (
      opportunity_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM opportunities o 
        WHERE o.id = contacts.opportunity_id 
        AND (o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
      )
    )
  );

-- Enable RLS on profiles_public view by recreating it with security_invoker
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT 
    id,
    user_id,
    display_name,
    timezone,
    is_approved,
    google_calendar_enabled,
    created_at,
    updated_at
  FROM public.profiles;

-- Grant access to authenticated users only (the view uses security_invoker so underlying RLS applies)
REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;