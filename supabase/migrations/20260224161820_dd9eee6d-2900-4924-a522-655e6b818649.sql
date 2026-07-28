
-- Update has_metro_access to support BOTH region-level and metro-level assignments.
-- Logic:
--   1. Admin/Leadership → all metros (bypass)
--   2. No assignments at all (no region AND no metro) → all metros (executive-level)
--   3. Has region assignment → sees all metros in that region
--   4. Has metro assignment → sees those specific metros
--   5. Both → union

CREATE OR REPLACE FUNCTION public.has_metro_access(_user_id UUID, _metro_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 1. Admin/Leadership bypass
    public.has_any_role(_user_id, ARRAY['admin', 'leadership']::app_role[])
    OR
    -- 2. No assignments at all → executive-level, sees everything
    (
      NOT EXISTS (SELECT 1 FROM public.user_region_assignments WHERE user_id = _user_id)
      AND NOT EXISTS (SELECT 1 FROM public.user_metro_assignments WHERE user_id = _user_id)
    )
    OR
    -- 3. Region-level assignment: user sees all metros within their assigned region(s)
    EXISTS (
      SELECT 1
      FROM public.user_region_assignments ura
      JOIN public.metros m ON m.region_id = ura.region_id
      WHERE ura.user_id = _user_id
        AND m.id = _metro_id
    )
    OR
    -- 4. Direct metro-level assignment
    EXISTS (
      SELECT 1
      FROM public.user_metro_assignments
      WHERE user_id = _user_id
        AND metro_id = _metro_id
    )
$$;

-- Add unique constraint to user_metro_assignments to prevent duplicates
ALTER TABLE public.user_metro_assignments
  DROP CONSTRAINT IF EXISTS user_metro_assignments_user_metro_unique;
ALTER TABLE public.user_metro_assignments
  ADD CONSTRAINT user_metro_assignments_user_metro_unique UNIQUE (user_id, metro_id);

-- RLS for user_metro_assignments (stewards and shepherds can manage)
ALTER TABLE public.user_metro_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Stewards and shepherds can view metro assignments" ON public.user_metro_assignments;
DROP POLICY IF EXISTS "Stewards and shepherds can manage metro assignments" ON public.user_metro_assignments;
DROP POLICY IF EXISTS "Stewards and shepherds can delete metro assignments" ON public.user_metro_assignments;

-- SELECT: admin, leadership, steward can view
CREATE POLICY "Admins and stewards can view metro assignments"
  ON public.user_metro_assignments FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership', 'steward']::app_role[]));

-- INSERT: admin, steward can assign
CREATE POLICY "Admins and stewards can assign metros"
  ON public.user_metro_assignments FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'steward']::app_role[]));

-- DELETE: admin, steward can remove
CREATE POLICY "Admins and stewards can remove metro assignments"
  ON public.user_metro_assignments FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'steward']::app_role[]));
