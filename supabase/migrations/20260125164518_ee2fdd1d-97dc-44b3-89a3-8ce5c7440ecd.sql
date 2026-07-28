-- Create regions table
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT,
  lead_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- RLS policies - viewable by all authenticated, manageable by admins
CREATE POLICY "Authenticated users can view regions"
  ON public.regions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage regions"
  ON public.regions
  FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]));

-- Add region_id to metros table
ALTER TABLE public.metros
  ADD COLUMN region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL;

-- Insert the 4 regions from the map
INSERT INTO public.regions (region_id, name, color, notes) VALUES
  ('REG-GREATPLAINS', 'Great Plains', '#86C07F', 'MT, ND, SD, NE, WY, MN, WI, IA - Position to be hired'),
  ('REG-SUNBELT', 'Sunbelt', '#F5C6A5', 'CA, NV, AZ, NM, TX, OK, AR, LA, MS, AL, FL, OR, ID, UT, WA, CO - Lead: Morgan'),
  ('REG-HEARTLAND', 'Heartland', '#F5E79D', 'TN, KY, NC, SC, GA - Position to be hired'),
  ('REG-NEWENGLAND', 'New England', '#A8D5E2', 'ME, NH, VT, MA, RI, CT, NY, NJ, PA, DE, MD, VA, WV, OH, IN, IL, MI - Lead: Shanelle');

-- Create trigger for updated_at
CREATE TRIGGER update_regions_updated_at
  BEFORE UPDATE ON public.regions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();