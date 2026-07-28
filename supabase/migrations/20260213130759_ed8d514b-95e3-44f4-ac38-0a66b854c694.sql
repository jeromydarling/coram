-- Drop the overly-restrictive "Admins can manage metros" policy
DROP POLICY "Admins can manage metros" ON public.metros;

-- Allow admin, leadership, regional_lead, and staff to INSERT metros
CREATE POLICY "Authenticated users can create metros"
ON public.metros
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'regional_lead'::app_role, 'staff'::app_role])
);

-- Allow admin, leadership, regional_lead, and staff to UPDATE metros
CREATE POLICY "Authenticated users can update metros"
ON public.metros
FOR UPDATE
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'regional_lead'::app_role, 'staff'::app_role])
);

-- Only admin and leadership can DELETE metros
CREATE POLICY "Admins can delete metros"
ON public.metros
FOR DELETE
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
);