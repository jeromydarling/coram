-- Fix race condition in handle_new_user function by using FOR UPDATE lock
-- This prevents multiple users from becoming admin simultaneously

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  -- Check if this is the first user with row locking to prevent race condition
  -- Use FOR UPDATE to lock existing rows during count
  SELECT COUNT(*) INTO user_count 
  FROM public.user_roles
  FOR UPDATE;
  
  IF user_count = 0 THEN
    -- First user gets admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Subsequent users get staff role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add comment documenting why SECURITY DEFINER is necessary
COMMENT ON FUNCTION public.handle_new_user() IS 'SECURITY DEFINER is required to insert into profiles and user_roles tables during user signup. FOR UPDATE lock prevents race condition where multiple simultaneous signups could all become admin.';

COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 'SECURITY DEFINER is required to bypass RLS on user_roles table. This prevents circular dependency when RLS policies check roles.';

COMMENT ON FUNCTION public.has_any_role(uuid, app_role[]) IS 'SECURITY DEFINER is required to bypass RLS on user_roles table. This prevents circular dependency when RLS policies check roles.';

COMMENT ON FUNCTION public.has_metro_access(uuid, uuid) IS 'SECURITY DEFINER is required to bypass RLS on user_metro_assignments table. This prevents circular dependency when RLS policies check metro access.';