-- Part 5: Create operator_signup_links table for outreach campaigns
CREATE TABLE public.operator_signup_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  campaign_name text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  default_archetype text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operator_signup_links ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can read signup links"
  ON public.operator_signup_links
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert signup links"
  ON public.operator_signup_links
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update signup links"
  ON public.operator_signup_links
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete signup links"
  ON public.operator_signup_links
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));