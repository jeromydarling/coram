-- Federation Phase 2.5 — Pivot to HMAC ingest pattern
--
-- WHAT: Adds ingest_url + ingest_secret_name columns to federated_apps.
--       Replaces the cross-DB-service-role-key pattern with a per-satellite
--       /ingest-essay edge function authenticated via HMAC shared secret.
--
-- WHY:  Lovable doesn't expose service-role key values, and storing them on the
--       hub means three master keys travel + sit in env permanently. The HMAC
--       pattern keeps each satellite's service-role key inside that satellite's
--       own project (auto-wired by Lovable as SUPABASE_SERVICE_ROLE_KEY) and
--       only requires a shared HMAC secret on both sides. Better security,
--       trivial rotation, no key sprawl.
--
-- HOW:  Idempotent + additive. Adds new columns, keeps old ones for one
--       deploy cycle then we drop them in a follow-up migration.

BEGIN;

-- ── 1) Add new columns to federated_apps ────────────────────────────────────
ALTER TABLE public.federated_apps
  ADD COLUMN IF NOT EXISTS ingest_url text,
  ADD COLUMN IF NOT EXISTS ingest_secret_name text;

COMMENT ON COLUMN public.federated_apps.ingest_url IS
  'Public HTTPS endpoint on the satellite that receives signed essay payloads from the hub. Example: https://ephuuewoqemcnqjojoip.supabase.co/functions/v1/ingest-essay';
COMMENT ON COLUMN public.federated_apps.ingest_secret_name IS
  'Name of the env var on the hub that holds the shared HMAC secret for this satellite. Example: VIGILIA_INGEST_SECRET. Same value must also be set as CROS_INGEST_SECRET inside the satellite project.';

-- ── 2) Recreate federated_apps_active view to include new columns ───────────
DROP VIEW IF EXISTS public.federated_apps_active;

CREATE VIEW public.federated_apps_active AS
SELECT
  source_app,
  display_name,
  display_order,
  public_base_url,
  accent_color,
  satellite_supabase_url,            -- legacy, kept for one cycle
  satellite_service_key_secret_name, -- legacy, kept for one cycle
  ingest_url,                        -- new HMAC pattern
  ingest_secret_name,                -- new HMAC pattern
  is_active,
  created_at,
  updated_at
FROM public.federated_apps
WHERE is_active = true
ORDER BY display_order, source_app;

GRANT SELECT ON public.federated_apps_active TO anon, authenticated, service_role;

-- ── 3) Seed ingest URLs for the 3 live satellites ───────────────────────────
-- Vigilia
UPDATE public.federated_apps
   SET ingest_url = 'https://ephuuewoqemcnqjojoip.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'VIGILIA_INGEST_SECRET'
 WHERE source_app = 'vigilia';

-- Resurrectio
UPDATE public.federated_apps
   SET ingest_url = 'https://lzincahqppvdeyzxqsqw.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'RESURRECTIO_INGEST_SECRET'
 WHERE source_app = 'resurrectio';

-- Schola
UPDATE public.federated_apps
   SET ingest_url = 'https://kpcannnhenymymnhpwib.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'THESCHOLA_INGEST_SECRET'
 WHERE source_app = 'theschola';

COMMIT;
