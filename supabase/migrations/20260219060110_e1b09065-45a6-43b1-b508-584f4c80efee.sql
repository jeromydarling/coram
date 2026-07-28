
-- Inbound leads table for marketing contact form
CREATE TABLE public.inbound_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  organization text,
  archetype text,
  message text,
  honeypot text, -- spam guard: should be empty
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inbound_leads ENABLE ROW LEVEL SECURITY;

-- Anon can insert (public form)
CREATE POLICY "Anyone can submit a lead"
  ON public.inbound_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view leads"
  ON public.inbound_leads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
