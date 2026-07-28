-- Federation Phase 3 — Add 9 more satellites to the publishing federation
BEGIN;

ALTER TABLE public.library_essays
  DROP CONSTRAINT IF EXISTS library_essays_target_app_chk;

ALTER TABLE public.library_essays
  ADD CONSTRAINT library_essays_target_app_chk
  CHECK (target_app IN (
    'thecros','vigilia','resurrectio','hortus','communis','transitus','bitoku','theschola',
    'refugium','propria','rehearso','viapublica','fabrica'
  ));

INSERT INTO public.federated_apps (
  source_app, display_name, description, accent_color,
  public_base_url, is_hub, is_active, display_order
) VALUES
  ('refugium',   'Refugium',     'A place of shelter — refuge & belonging.',          '#475569', 'https://refugium.app',     false, true, 80),
  ('propria',    'Propria',      'What is one''s own — vocation & calling.',          '#9333ea', 'https://propria.app',      false, true, 90),
  ('rehearso',   'Rehearso',     'Practice toward the moment — preparation & form.',  '#0891b2', 'https://rehearso.app',     false, true, 100),
  ('viapublica', 'Via Publica',  'The public way — civic life & common road.',        '#b45309', 'https://viapublica.com',   false, true, 110),
  ('fabrica',    'Fabrica Forge','The workshop — making, craft, and cathedral build.','#78350f', 'https://thefabrica.app',   false, true, 120)
ON CONFLICT (source_app) DO NOTHING;

UPDATE public.federated_apps SET ingest_url = 'https://piaoyalquwfusbiedouq.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'HORTUS_INGEST_SECRET' WHERE source_app = 'hortus';
UPDATE public.federated_apps SET ingest_url = 'https://jiefixzipfquwlqyzrcg.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'REFUGIUM_INGEST_SECRET' WHERE source_app = 'refugium';
UPDATE public.federated_apps SET ingest_secret_name = 'TRANSITUS_INGEST_SECRET' WHERE source_app = 'transitus';
UPDATE public.federated_apps SET ingest_url = 'https://ebsjikndtrtlvryphkgk.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'COMMUNIS_INGEST_SECRET' WHERE source_app = 'communis';
UPDATE public.federated_apps SET ingest_url = 'https://svmobotemmnsorkvlprb.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'PROPRIA_INGEST_SECRET' WHERE source_app = 'propria';
UPDATE public.federated_apps SET ingest_url = 'https://oumbwqgibozyddwntstc.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'BITOKU_INGEST_SECRET' WHERE source_app = 'bitoku';
UPDATE public.federated_apps SET ingest_url = 'https://tidoerbzdomhtfyuovji.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'REHEARSO_INGEST_SECRET' WHERE source_app = 'rehearso';
UPDATE public.federated_apps SET ingest_url = 'https://tckqfpcnxjgatetfntrb.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'VIAPUBLICA_INGEST_SECRET' WHERE source_app = 'viapublica';
UPDATE public.federated_apps SET ingest_url = 'https://wqnplepwcbbmtvajxnqx.supabase.co/functions/v1/ingest-essay', ingest_secret_name = 'FABRICA_INGEST_SECRET' WHERE source_app = 'fabrica';

COMMIT;