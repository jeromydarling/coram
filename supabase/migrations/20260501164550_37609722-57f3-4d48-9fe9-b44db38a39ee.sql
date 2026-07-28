BEGIN;

ALTER TABLE public.library_essays
  DROP CONSTRAINT IF EXISTS library_essays_target_app_chk;

ALTER TABLE public.library_essays
  ADD CONSTRAINT library_essays_target_app_chk
  CHECK (target_app IN (
    'thecros','vigilia','resurrectio','hortus','communis','transitus','bitoku','theschola',
    'refugium','propria','rehearso','viapublica','fabrica',
    'custodia'
  ));

INSERT INTO public.federated_apps (
  source_app, display_name, description, accent_color,
  public_base_url, is_hub, is_active, display_order
) VALUES
  ('custodia', 'Custodia', 'Stewardship for the land — care, conservation, and the long view.',
   '#1f6f4a', 'https://thecustodia.lovable.app', false, true, 130)
ON CONFLICT (source_app) DO NOTHING;

UPDATE public.federated_apps
   SET ingest_url = 'https://uoezwzidkrqnnjuavptf.supabase.co/functions/v1/ingest-essay',
       ingest_secret_name = 'CUSTODIA_INGEST_SECRET'
 WHERE source_app = 'custodia';

COMMIT;