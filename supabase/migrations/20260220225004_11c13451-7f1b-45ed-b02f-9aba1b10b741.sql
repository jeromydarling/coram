
-- Add ministry_role column to profiles (experience role, not permission role)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ministry_role text DEFAULT 'companion';

-- Add validation trigger (not CHECK constraint) for ministry_role values
CREATE OR REPLACE FUNCTION public.validate_ministry_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ministry_role IS NOT NULL AND NEW.ministry_role NOT IN ('shepherd', 'companion', 'visitor') THEN
    RAISE EXCEPTION 'Invalid ministry_role: %. Must be shepherd, companion, or visitor.', NEW.ministry_role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_ministry_role_trigger ON public.profiles;
CREATE TRIGGER validate_ministry_role_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ministry_role();

-- Backfill: admin/leadership users → shepherd, staff → companion (already default)
-- Volunteers table users → visitor (best effort via matching)
UPDATE public.profiles p
SET ministry_role = 'shepherd'
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id
  AND ur.role IN ('admin', 'leadership')
);
