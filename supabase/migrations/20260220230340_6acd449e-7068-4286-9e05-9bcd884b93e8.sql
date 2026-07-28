-- Backfill: grant steward role to all existing admin users
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'steward'::app_role
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id AND ur2.role = 'steward'
  );

-- Auto-assign steward to first user of a tenant
CREATE OR REPLACE FUNCTION public.auto_assign_steward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_steward_exists boolean;
BEGIN
  v_tenant_id := NEW.tenant_id;
  IF v_tenant_id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE p.tenant_id = v_tenant_id AND ur.role = 'steward'
  ) INTO v_steward_exists;

  IF NOT v_steward_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'steward')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_assign_steward ON public.profiles;
CREATE TRIGGER trg_auto_assign_steward
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_steward();

-- Prevent deletion of last steward
CREATE OR REPLACE FUNCTION public.prevent_last_steward_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_remaining integer;
BEGIN
  IF OLD.role != 'steward' THEN RETURN OLD; END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE user_id = OLD.user_id;
  IF v_tenant_id IS NULL THEN RETURN OLD; END IF;

  SELECT COUNT(*) INTO v_remaining
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE p.tenant_id = v_tenant_id AND ur.role = 'steward' AND ur.id != OLD.id;

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last Steward from this workspace';
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_last_steward_deletion ON public.user_roles;
CREATE TRIGGER trg_prevent_last_steward_deletion
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_steward_deletion();