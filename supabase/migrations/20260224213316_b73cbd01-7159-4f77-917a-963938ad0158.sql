-- Add search keyword columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS search_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_keywords_source text DEFAULT 'none';

-- Validation trigger for search_keywords_source
CREATE OR REPLACE FUNCTION public.validate_search_keywords_source()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.search_keywords_source NOT IN ('none', 'enrichment', 'manual', 'both') THEN
    RAISE EXCEPTION 'Invalid search_keywords_source: %', NEW.search_keywords_source;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_search_keywords_source
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_search_keywords_source();