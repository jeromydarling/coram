-- Fix profiles_public view to use security_invoker (prevents RLS bypass)
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  display_name,
  timezone,
  google_calendar_enabled,
  is_approved,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;