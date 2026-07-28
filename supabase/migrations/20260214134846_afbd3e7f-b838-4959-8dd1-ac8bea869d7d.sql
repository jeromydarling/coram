
-- Add unique constraint on org_id so ON CONFLICT works
ALTER TABLE public.org_watchlist ADD CONSTRAINT org_watchlist_org_id_key UNIQUE (org_id);

-- Create the auto-enroll trigger function
CREATE OR REPLACE FUNCTION public.auto_enroll_watchlist()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.website_url IS NOT NULL 
     AND NEW.website_url != ''
     AND (TG_OP = 'INSERT' OR OLD.website_url IS NULL OR OLD.website_url = '' OR OLD.website_url IS DISTINCT FROM NEW.website_url)
  THEN
    INSERT INTO public.org_watchlist (org_id, website_url, enabled, cadence)
    VALUES (NEW.id, NEW.website_url, true, 'weekly')
    ON CONFLICT (org_id) DO UPDATE SET website_url = EXCLUDED.website_url;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER trg_auto_enroll_watchlist
  AFTER INSERT OR UPDATE OF website_url ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_watchlist();

-- Backfill existing opportunities with URLs
INSERT INTO public.org_watchlist (org_id, website_url, enabled, cadence)
SELECT id, website_url, true, 'weekly'
FROM public.opportunities
WHERE website_url IS NOT NULL AND website_url != ''
ON CONFLICT (org_id) DO NOTHING;
