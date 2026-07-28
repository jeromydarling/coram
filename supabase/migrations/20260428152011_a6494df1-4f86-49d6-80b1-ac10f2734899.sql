BEGIN;

ALTER TABLE public.federated_apps
  ADD COLUMN IF NOT EXISTS ingest_url text,
  ADD COLUMN IF NOT EXISTS ingest_secret_name text;

COMMENT ON COLUMN public.federated_apps.ingest_url IS
  'Public HTTPS endpoint on the satellite that receives signed essay payloads from the hub. Example: https://ephuuewoqemcnqjojoip.supabase.co/functions/v1/ingest-essay';
COMMENT ON COLUMN public.federated_apps.ingest_secret_name IS
  'Name of the env var on the hub that holds the shared HMAC secret for this satellite. Example: VIGILIA_INGEST_SECRET. Same value must also be set as CROS_INGEST_SECRET inside the satellite project.';

DROP VIEW IF EXISTS public.federated_apps_active;

CREATE VIEW public.federated_apps_active AS
SELECT
  source_app,
  display_name,
  display_order,
  public_base_url,
  accent_color,
  satellite_supabase_url,
  satellite_service_key_secret_name,
  ingest_url,
  ingest_secret_name,
  is_active,
  created_at,
  updated_at
FROM public.federated_apps
WHERE is_active = true
ORDER BY display_order, source_app;

GRANT SELECT ON public.federated_apps_active TO anon, authenticated, service_role;

UPDATE public.federated_apps
   SET ingest_url = 'https://ephuuewoqemcnqjojoip.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'VIGILIA_INGEST_SECRET'
 WHERE source_app = 'vigilia';

UPDATE public.federated_apps
   SET ingest_url = 'https://lzincahqppvdeyzxqsqw.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'RESURRECTIO_INGEST_SECRET'
 WHERE source_app = 'resurrectio';

UPDATE public.federated_apps
   SET ingest_url = 'https://kpcannnhenymymnhpwib.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'THESCHOLA_INGEST_SECRET'
 WHERE source_app = 'theschola';

COMMIT;