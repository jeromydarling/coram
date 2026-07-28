-- Create mission_snapshots lookup table
CREATE TABLE public.mission_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'hsl(var(--muted-foreground))',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mission_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view mission snapshots"
ON public.mission_snapshots FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage mission snapshots"
ON public.mission_snapshots FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Change mission_snapshot from text to text[] on opportunities
ALTER TABLE public.opportunities 
ALTER COLUMN mission_snapshot TYPE TEXT[] USING 
  CASE WHEN mission_snapshot IS NOT NULL AND mission_snapshot != '' 
       THEN ARRAY[mission_snapshot] 
       ELSE NULL 
  END;

-- Insert some default mission snapshot options
INSERT INTO public.mission_snapshots (name, sort_order) VALUES
  ('Digital Inclusion', 1),
  ('Workforce Development', 2),
  ('Community Outreach', 3),
  ('Education Access', 4),
  ('Housing Support', 5),
  ('Refugee Services', 6),
  ('Senior Services', 7),
  ('Youth Programs', 8);