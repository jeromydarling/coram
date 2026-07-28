-- Update handle_new_user function to also store timezone
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  -- Insert profile with timezone
  INSERT INTO public.profiles (user_id, display_name, timezone)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'display_name',
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'America/Chicago')
  );
  
  -- Check if this is the first user with row locking to prevent race condition
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
$function$;