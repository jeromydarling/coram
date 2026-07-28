-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'regional_lead', 'staff', 'leadership');

-- Create user_roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table with display_name only
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_metro_assignments table for metro-based access
CREATE TABLE public.user_metro_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    metro_id UUID REFERENCES public.metros(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, metro_id)
);

-- Add owner_id column to opportunities table
ALTER TABLE public.opportunities ADD COLUMN owner_id UUID REFERENCES auth.users(id);

-- Add owner_id column to anchor_pipeline table
ALTER TABLE public.anchor_pipeline ADD COLUMN owner_id UUID REFERENCES auth.users(id);

-- Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metro_assignments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any of specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Function to check if user has access to a metro
CREATE OR REPLACE FUNCTION public.has_metro_access(_user_id UUID, _metro_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins and Leadership have access to all metros
    public.has_any_role(_user_id, ARRAY['admin', 'leadership']::app_role[])
    OR
    -- Regional leads and staff only have access to assigned metros
    EXISTS (
      SELECT 1
      FROM public.user_metro_assignments
      WHERE user_id = _user_id
        AND metro_id = _metro_id
    )
$$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  -- Assign default 'staff' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Authenticated users can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_metro_assignments
CREATE POLICY "Users can view metro assignments"
  ON public.user_metro_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage metro assignments"
  ON public.user_metro_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop old permissive policies on opportunities
DROP POLICY IF EXISTS "Allow all select on opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Allow all insert on opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Allow all update on opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Allow all delete on opportunities" ON public.opportunities;

-- New RLS Policies for opportunities (metro-based + ownership)
CREATE POLICY "Users can view opportunities in assigned metros"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can create opportunities in assigned metros"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can update their own opportunities or admins any"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR (owner_id = auth.uid() AND public.has_metro_access(auth.uid(), metro_id))
  );

CREATE POLICY "Admins can delete opportunities"
  ON public.opportunities FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- Drop old permissive policies on anchor_pipeline
DROP POLICY IF EXISTS "Allow all select on anchor_pipeline" ON public.anchor_pipeline;
DROP POLICY IF EXISTS "Allow all insert on anchor_pipeline" ON public.anchor_pipeline;
DROP POLICY IF EXISTS "Allow all update on anchor_pipeline" ON public.anchor_pipeline;
DROP POLICY IF EXISTS "Allow all delete on anchor_pipeline" ON public.anchor_pipeline;

-- New RLS Policies for anchor_pipeline
CREATE POLICY "Users can view pipeline in assigned metros"
  ON public.anchor_pipeline FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can create pipeline in assigned metros"
  ON public.anchor_pipeline FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can update their own pipeline or admins any"
  ON public.anchor_pipeline FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR (owner_id = auth.uid() AND public.has_metro_access(auth.uid(), metro_id))
  );

CREATE POLICY "Admins can delete pipeline"
  ON public.anchor_pipeline FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- Update triggers for profiles and user_roles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update remaining tables with new RLS (metro-based access)
-- Drop old policies on metros
DROP POLICY IF EXISTS "Allow all select on metros" ON public.metros;
DROP POLICY IF EXISTS "Allow all insert on metros" ON public.metros;
DROP POLICY IF EXISTS "Allow all update on metros" ON public.metros;
DROP POLICY IF EXISTS "Allow all delete on metros" ON public.metros;

CREATE POLICY "Users can view assigned metros"
  ON public.metros FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), id)
  );

CREATE POLICY "Admins can manage metros"
  ON public.metros FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- Update anchors policies
DROP POLICY IF EXISTS "Allow all select on anchors" ON public.anchors;
DROP POLICY IF EXISTS "Allow all insert on anchors" ON public.anchors;
DROP POLICY IF EXISTS "Allow all update on anchors" ON public.anchors;
DROP POLICY IF EXISTS "Allow all delete on anchors" ON public.anchors;

CREATE POLICY "Users can view anchors in assigned metros"
  ON public.anchors FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can manage anchors in assigned metros"
  ON public.anchors FOR ALL
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- Update events policies
DROP POLICY IF EXISTS "Allow all select on events" ON public.events;
DROP POLICY IF EXISTS "Allow all insert on events" ON public.events;
DROP POLICY IF EXISTS "Allow all update on events" ON public.events;
DROP POLICY IF EXISTS "Allow all delete on events" ON public.events;

CREATE POLICY "Users can view events in assigned metros"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can manage events in assigned metros"
  ON public.events FOR ALL
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- Update activities policies
DROP POLICY IF EXISTS "Allow all select on activities" ON public.activities;
DROP POLICY IF EXISTS "Allow all insert on activities" ON public.activities;
DROP POLICY IF EXISTS "Allow all update on activities" ON public.activities;
DROP POLICY IF EXISTS "Allow all delete on activities" ON public.activities;

CREATE POLICY "Users can view activities in assigned metros"
  ON public.activities FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can manage activities in assigned metros"
  ON public.activities FOR ALL
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- Update contacts policies (via opportunity metro)
DROP POLICY IF EXISTS "Allow all select on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow all insert on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow all update on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow all delete on contacts" ON public.contacts;

CREATE POLICY "Users can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = contacts.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "Users can manage contacts in assigned metros"
  ON public.contacts FOR ALL
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = contacts.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );