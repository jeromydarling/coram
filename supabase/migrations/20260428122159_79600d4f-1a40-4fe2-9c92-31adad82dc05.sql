-- Federation App Registry
BEGIN;

CREATE TABLE IF NOT EXISTS public.federated_apps (
  source_app text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  accent_color text NOT NULL DEFAULT '#64748b',
  public_base_url text,
  satellite_supabase_url text,
  satellite_service_key_secret_name text,
  is_hub boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federated_apps_active_order
  ON public.federated_apps (is_active, display_order, source_app);

CREATE OR REPLACE FUNCTION public.federated_apps_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS federated_apps_set_updated_at ON public.federated_apps;
CREATE TRIGGER federated_apps_set_updated_at
BEFORE UPDATE ON public.federated_apps
FOR EACH ROW EXECUTE FUNCTION public.federated_apps_set_updated_at();

ALTER TABLE public.federated_apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "federated_apps operator read" ON public.federated_apps;
CREATE POLICY "federated_apps operator read"
  ON public.federated_apps FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[]));

DROP POLICY IF EXISTS "federated_apps admin write" ON public.federated_apps;
CREATE POLICY "federated_apps admin write"
  ON public.federated_apps FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

INSERT INTO public.federated_apps (source_app, display_name, description, accent_color, public_base_url, is_hub, is_active, display_order)
VALUES
  ('thecros',     'The CROS',     'The federation hub — operator console & editorial.', '#0f766e', 'https://thecros.app',     true,  true, 10),
  ('vigilia',     'Vigilia',      'A liturgy of attention — senior care & family rituals.', '#7c3aed', 'https://vigilia.app',     false, true, 20),
  ('resurrectio', 'Resurrectio',  'Reentry, recovery, restoration.',                 '#dc2626', 'https://resurrectio.app', false, true, 30),
  ('hortus',      'Hortus',       'Cultivated growth — community gardens & rule of life.', '#16a34a', 'https://hortus.app',      false, true, 40),
  ('communis',    'Communis',     'Shared signal across the network.',               '#0284c7', 'https://communis.app',    false, true, 50),
  ('transitus',   'Transitus',    'Passages and pilgrimage.',                        '#ea580c', 'https://transitus.app',   false, true, 60),
  ('bitoku',      'Bitoku',       'Virtue formation through essays & reflection.',   '#a16207', 'https://bitoku.app',      false, true, 70)
ON CONFLICT (source_app) DO NOTHING;

CREATE OR REPLACE VIEW public.federated_apps_active AS
  SELECT *
  FROM public.federated_apps
  WHERE is_active = true
  ORDER BY display_order, source_app;

GRANT SELECT ON public.federated_apps_active TO authenticated;

COMMIT;

-- ============================================
-- Phase 2 — Publishing Hub: extend library_essays
-- ============================================
BEGIN;

ALTER TABLE public.library_essays
  ADD COLUMN IF NOT EXISTS target_app text NOT NULL DEFAULT 'thecros';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'library_essays_target_app_chk'
      AND conrelid = 'public.library_essays'::regclass
  ) THEN
    ALTER TABLE public.library_essays
      ADD CONSTRAINT library_essays_target_app_chk
      CHECK (target_app IN ('thecros','vigilia','resurrectio','hortus','communis','transitus','bitoku'));
  END IF;
END$$;

ALTER TABLE public.library_essays
  ADD COLUMN IF NOT EXISTS synced_to_satellite_at timestamptz;

ALTER TABLE public.library_essays
  ADD COLUMN IF NOT EXISTS sync_error text;

CREATE INDEX IF NOT EXISTS idx_library_essays_pending_satellite_sync
  ON public.library_essays (target_app, status, synced_to_satellite_at)
  WHERE target_app <> 'thecros'
    AND status = 'published'
    AND synced_to_satellite_at IS NULL;

COMMIT;

-- ============================================
-- Add Schola to the federation registry
-- ============================================
BEGIN;

INSERT INTO public.federated_apps (
  source_app, display_name, description, accent_color,
  public_base_url, is_hub, is_active, display_order
)
VALUES (
  'theschola', 'Schola',
  'Catholic classical schools — community, curriculum, formation.',
  '#1e40af', 'https://theschola.app', false, true, 25
)
ON CONFLICT (source_app) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  description       = EXCLUDED.description,
  accent_color      = EXCLUDED.accent_color,
  public_base_url   = EXCLUDED.public_base_url,
  is_active         = EXCLUDED.is_active,
  display_order     = EXCLUDED.display_order,
  updated_at        = now();

COMMIT;