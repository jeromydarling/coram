-- Create user_region_assignments table
CREATE TABLE public.user_region_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, region_id)
);

-- Enable RLS
ALTER TABLE public.user_region_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_region_assignments
CREATE POLICY "Admins can manage region assignments"
ON public.user_region_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all region assignments"
ON public.user_region_assignments
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own region assignments"
ON public.user_region_assignments
FOR SELECT
USING (auth.uid() = user_id);

-- Update has_metro_access function to check region assignments
-- A user has metro access if:
-- 1. They are admin/leadership (global access), OR
-- 2. They are assigned to the region that the metro belongs to
CREATE OR REPLACE FUNCTION public.has_metro_access(_user_id uuid, _metro_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins and Leadership have access to all metros
    public.has_any_role(_user_id, ARRAY['admin', 'leadership']::app_role[])
    OR
    -- Users assigned to the region that contains this metro
    EXISTS (
      SELECT 1
      FROM public.user_region_assignments ura
      JOIN public.metros m ON m.region_id = ura.region_id
      WHERE ura.user_id = _user_id
        AND m.id = _metro_id
    )
$$;

-- Migrate existing user_metro_assignments to user_region_assignments
-- For each user, find the regions of their assigned metros and assign those regions
INSERT INTO public.user_region_assignments (user_id, region_id)
SELECT DISTINCT uma.user_id, m.region_id
FROM public.user_metro_assignments uma
JOIN public.metros m ON m.id = uma.metro_id
WHERE m.region_id IS NOT NULL
ON CONFLICT (user_id, region_id) DO NOTHING;