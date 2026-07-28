-- Add approval status to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Add approval tracking columns
ALTER TABLE public.profiles 
ADD COLUMN approved_by uuid REFERENCES auth.users(id),
ADD COLUMN approved_at timestamptz;

-- Update the handle_new_user function to NOT auto-approve
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count INTEGER;
  user_email TEXT;
BEGIN
  -- Get the user's email
  user_email := NEW.email;
  
  -- Validate email domain
  IF user_email IS NULL OR NOT user_email LIKE '%@pcsforpeople.com' THEN
    RAISE EXCEPTION 'Only @pcsforpeople.com email addresses are allowed';
  END IF;
  
  -- Insert profile with timezone (not approved by default)
  INSERT INTO public.profiles (user_id, display_name, timezone, is_approved)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'display_name',
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'America/Chicago'),
    false
  );
  
  -- Check if this is the first user with row locking to prevent race condition
  SELECT COUNT(*) INTO user_count 
  FROM public.user_roles
  FOR UPDATE;
  
  IF user_count = 0 THEN
    -- First user gets admin role AND is auto-approved
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    -- Auto-approve the first admin
    UPDATE public.profiles 
    SET is_approved = true, approved_at = now()
    WHERE user_id = NEW.id;
  ELSE
    -- Subsequent users get staff role (pending approval)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update the profiles_public view to include approval status
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
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

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;

-- Create a function for admins to approve users
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;
  
  UPDATE public.profiles
  SET 
    is_approved = true,
    approved_by = auth.uid(),
    approved_at = now()
  WHERE user_id = target_user_id;
  
  RETURN true;
END;
$$;

-- Create a function for admins to revoke approval
CREATE OR REPLACE FUNCTION public.revoke_user_approval(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can revoke user approval';
  END IF;
  
  UPDATE public.profiles
  SET 
    is_approved = false,
    approved_by = NULL,
    approved_at = NULL
  WHERE user_id = target_user_id;
  
  RETURN true;
END;
$$;