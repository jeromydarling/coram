
CREATE TABLE public.archetype_interest_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  archetype_key text NOT NULL,
  source text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but allow anonymous inserts (public signals)
ALTER TABLE public.archetype_interest_signals ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous aggregation)
CREATE POLICY "Anyone can insert interest signals"
  ON public.archetype_interest_signals
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read interest signals"
  ON public.archetype_interest_signals
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
