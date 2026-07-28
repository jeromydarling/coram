-- Create lookup table for Best Partnership Angle options
CREATE TABLE public.partnership_angles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partnership_angles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Anyone can read partnership angles"
  ON public.partnership_angles
  FOR SELECT
  USING (true);

-- Allow admins to manage
CREATE POLICY "Admins can manage partnership angles"
  ON public.partnership_angles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_partnership_angles_updated_at
  BEFORE UPDATE ON public.partnership_angles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Convert best_partnership_angle from TEXT to TEXT[] array
ALTER TABLE public.opportunities 
  ALTER COLUMN best_partnership_angle TYPE TEXT[] 
  USING CASE 
    WHEN best_partnership_angle IS NOT NULL AND best_partnership_angle != '' 
    THEN ARRAY[best_partnership_angle] 
    ELSE NULL 
  END;

-- Seed with default options
INSERT INTO public.partnership_angles (name, sort_order) VALUES
  ('Device Distribution', 1),
  ('Referral Partner', 2),
  ('Workforce Development', 3),
  ('Digital Skills Training', 4),
  ('Community Outreach', 5);