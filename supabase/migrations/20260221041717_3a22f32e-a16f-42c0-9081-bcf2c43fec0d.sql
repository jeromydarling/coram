
-- Helper function to temporarily disable/enable the on_auth_user_created trigger
-- Used by qa-seed-user edge function to avoid trigger conflicts during user creation
CREATE OR REPLACE FUNCTION public.toggle_auth_trigger(p_enable boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_enable THEN
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
  ELSE
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
  END IF;
END;
$$;

-- Only allow service_role to call this
REVOKE ALL ON FUNCTION public.toggle_auth_trigger(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_auth_trigger(boolean) FROM anon;
REVOKE ALL ON FUNCTION public.toggle_auth_trigger(boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_auth_trigger(boolean) TO service_role;
