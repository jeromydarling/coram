-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view metro assignments" ON public.user_metro_assignments;

-- Create policy for users to view their own assignments
CREATE POLICY "Users can view own metro assignments"
  ON public.user_metro_assignments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for admins to view all assignments
CREATE POLICY "Admins can view all metro assignments"
  ON public.user_metro_assignments
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));