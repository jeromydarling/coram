-- Federation Phase 4 — Add Custodia satellite
--
-- WHAT: Adds the 14th federation member, Custodia (custodia.lovable.app).
--       Custodia is a stewardship platform for land trusts, watershed groups,
--       and habitat restoration teams ("Stewardship for the land").
-- WHY:  Custodia gets the same federation publishing as every other satellite,
--       per the user's directive that "every app in the federation should have
--       SEO content generation and function the same way across the board."
-- HOW:  1) Extend library_essays.target_app CHECK constraint with 'custodia'
--       2) Insert custodia row in federated_apps registry
--       3) Set ingest_url + ingest_secret_name (Supabase ref uoezwzidkrqnnjuavptf)
--
-- STACK NOTE: Custodia is built on TanStack Start + Bun + Cloudflare Workers
-- (NOT Lovable Vite + React). The federation contract is unchanged: Custodia
-- exposes a Supabase Edge Function (Deno) at /functions/v1/ingest-essay just
-- like the other 13 satellites. The TanStack frontend reads from the same
-- public.published_essays table on the satellite's Supabase.

BEGIN;

-- ── 1) Extend target_app CHECK constraint ────────────────────────────────────
ALTER TABLE public.library_essays
  DROP CONSTRAINT IF EXISTS library_essays_target_app_chk;

ALTER TABLE public.library_essays
  ADD CONSTRAINT library_essays_target_app_chk
  CHECK (target_app IN (
    'thecros',
    'vigilia',
    'resurrectio',
    'hortus',
    'communis',
    'transitus',
    'bitoku',
    'theschola',
    -- Phase 3:
    'refugium',
    'propria',
    'rehearso',
    'viapublica',
    'fabrica',
    -- Phase 4:
    'custodia'
  ));

-- ── 2) Insert custodia row in federated_apps registry ────────────────────────
-- (display_order leaves room: existing rows fill 10..120; new row at 130)

INSERT INTO public.federated_apps (
  source_app, display_name, description, accent_color,
  public_base_url, is_hub, is_active, display_order
) VALUES
  ('custodia', 'Custodia', 'Stewardship for the land — care, conservation, and the long view.',
   '#1f6f4a', 'https://thecustodia.lovable.app', false, true, 130)
ON CONFLICT (source_app) DO NOTHING;

-- ── 3) Set ingest_url + ingest_secret_name for custodia ──────────────────────
UPDATE public.federated_apps
   SET ingest_url = 'https://uoezwzidkrqnnjuavptf.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'CUSTODIA_INGEST_SECRET'
 WHERE source_app = 'custodia';

COMMIT;
