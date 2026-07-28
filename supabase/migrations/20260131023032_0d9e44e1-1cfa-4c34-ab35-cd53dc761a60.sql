-- Add slug columns to contacts, opportunities, and events
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique indexes for slugs
CREATE UNIQUE INDEX IF NOT EXISTS contacts_slug_unique ON public.contacts(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_slug_unique ON public.opportunities(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique ON public.events(slug) WHERE slug IS NOT NULL;

-- Function to generate a URL-safe slug from text
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          trim(input_text),
          '[^a-zA-Z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
END;
$$;

-- Function to generate unique slug for contacts
CREATE OR REPLACE FUNCTION public.generate_contact_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Only regenerate slug if name changed or slug is null
  IF TG_OP = 'UPDATE' AND OLD.name = NEW.name AND NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  base_slug := public.generate_slug(NEW.name);
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.contacts WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- Function to generate unique slug for opportunities
CREATE OR REPLACE FUNCTION public.generate_opportunity_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.organization = NEW.organization AND NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  base_slug := public.generate_slug(NEW.organization);
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.opportunities WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- Function to generate unique slug for events
CREATE OR REPLACE FUNCTION public.generate_event_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.event_name = NEW.event_name AND NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  base_slug := public.generate_slug(NEW.event_name);
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- Create triggers to auto-generate slugs
DROP TRIGGER IF EXISTS contacts_generate_slug ON public.contacts;
CREATE TRIGGER contacts_generate_slug
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_contact_slug();

DROP TRIGGER IF EXISTS opportunities_generate_slug ON public.opportunities;
CREATE TRIGGER opportunities_generate_slug
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_opportunity_slug();

DROP TRIGGER IF EXISTS events_generate_slug ON public.events;
CREATE TRIGGER events_generate_slug
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_event_slug();