-- Create grant_alignments table for managing grant categories
CREATE TABLE public.grant_alignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT 'hsl(var(--muted-foreground))',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grant_alignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view grant alignments"
ON public.grant_alignments
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage grant alignments"
ON public.grant_alignments
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_grant_alignments_updated_at
BEFORE UPDATE ON public.grant_alignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with common grant alignment categories
INSERT INTO public.grant_alignments (name, description, color, sort_order) VALUES
  ('Digital Equity', 'Programs focused on closing the digital divide', 'hsl(200, 80%, 50%)', 1),
  ('Workforce Development', 'Job training and employment programs', 'hsl(150, 70%, 45%)', 2),
  ('Housing Stability', 'Housing assistance and stability programs', 'hsl(30, 80%, 55%)', 3),
  ('Education', 'K-12 and adult education initiatives', 'hsl(280, 70%, 55%)', 4),
  ('Healthcare Access', 'Health services and telehealth programs', 'hsl(0, 70%, 55%)', 5),
  ('Community Development', 'Neighborhood and community building', 'hsl(45, 80%, 50%)', 6),
  ('Refugee Services', 'Support for refugee and immigrant populations', 'hsl(180, 60%, 45%)', 7),
  ('Other', 'Other grant alignment categories', 'hsl(var(--muted-foreground))', 99);