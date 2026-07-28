
-- public_metro_pages: aggregated civic narrative pages for public SEO
CREATE TABLE public.public_metro_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid REFERENCES public.metros(id) ON DELETE CASCADE NOT NULL,
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  momentum_summary text NOT NULL DEFAULT '',
  narrative_summary text NOT NULL DEFAULT '',
  archetypes_active jsonb DEFAULT '[]'::jsonb,
  volunteer_patterns text NOT NULL DEFAULT '',
  reflection_block text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Status validation trigger
CREATE OR REPLACE FUNCTION public.validate_public_metro_page_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'Invalid public_metro_pages status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_public_metro_page_status
  BEFORE INSERT OR UPDATE ON public.public_metro_pages
  FOR EACH ROW EXECUTE FUNCTION public.validate_public_metro_page_status();

CREATE TRIGGER trg_public_metro_pages_updated_at
  BEFORE UPDATE ON public.public_metro_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.public_metro_pages ENABLE ROW LEVEL SECURITY;

-- Public read for published pages
CREATE POLICY "Anyone can read published metro pages"
  ON public.public_metro_pages FOR SELECT
  USING (status = 'published');

-- Admin can manage all
CREATE POLICY "Admins can manage metro pages"
  ON public.public_metro_pages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
