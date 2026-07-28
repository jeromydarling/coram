-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

-- Users can only view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all roles for management purposes
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));