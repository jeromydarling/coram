
-- Fix: auto_assign_steward trigger references NEW.tenant_id but profiles has no tenant_id column.
-- This crashes every new user signup. Drop the broken trigger.
DROP TRIGGER IF EXISTS trg_auto_assign_steward ON public.profiles;

-- Also fix the function to not reference a non-existent column
-- We'll rewrite it to get tenant_id from tenant_users instead
CREATE OR REPLACE FUNCTION public.auto_assign_steward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_steward_exists boolean;
BEGIN
  -- Get tenant from tenant_users instead of profiles.tenant_id
  SELECT tu.tenant_id INTO v_tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = NEW.user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.tenant_users tu ON tu.user_id = ur.user_id
    WHERE tu.tenant_id = v_tenant_id AND ur.role = 'steward'
  ) INTO v_steward_exists;

  IF NOT v_steward_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'steward')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach the trigger with the fixed function
CREATE TRIGGER trg_auto_assign_steward
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_steward();
