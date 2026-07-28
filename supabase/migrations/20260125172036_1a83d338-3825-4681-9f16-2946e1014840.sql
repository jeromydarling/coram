-- Create sectors table for dynamic partner tier/sector management
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT 'hsl(var(--muted-foreground))',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active sectors
CREATE POLICY "Authenticated users can view sectors" 
ON public.sectors 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only admins can manage sectors
CREATE POLICY "Admins can manage sectors" 
ON public.sectors 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Insert default sectors
INSERT INTO public.sectors (name, description, color, sort_order) VALUES
  ('Anchor', 'High-volume strategic partners', 'hsl(var(--accent))', 1),
  ('Distribution', 'Device distribution partners', 'hsl(var(--primary))', 2),
  ('Referral', 'Customer referral partners', 'hsl(var(--info))', 3),
  ('Workforce', 'Workforce development organizations', 'hsl(var(--warning))', 4),
  ('Housing', 'Housing and shelter organizations', 'hsl(var(--success))', 5),
  ('Education', 'Schools and educational institutions', 'hsl(var(--chart-5))', 6),
  ('Other', 'Other partner types', 'hsl(var(--muted-foreground))', 7);

-- Create trigger to update updated_at
CREATE TRIGGER update_sectors_updated_at
BEFORE UPDATE ON public.sectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.sectors IS 'Dynamic partner tier/sector categories for opportunities';