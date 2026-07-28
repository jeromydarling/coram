-- Federation App Registry
--
-- WHAT: Source of truth for the federation app switcher. One row per app in the federation.
-- WHERE: Lives on thecros (the hub). Read by useFederationScope() and the sidebar switcher.
-- WHY:  Adding a new app to the federation should be one row in this table — never a code change.
--       Drives the operator console's app switcher, accent colors, and per-app identity.
--
-- IDEMPOTENT: safe to re-run. Seed inserts use ON CONFLICT DO NOTHING.

BEGIN;

-- ── 1) federated_apps — registry table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.federated_apps (
  source_app text PRIMARY KEY,                 -- canonical slug, matches library_essays.target_app
  display_name text NOT NULL,                  -- e.g. "Vigilia"
  description text,                            -- short blurb shown in switcher dropdown
  accent_color text NOT NULL DEFAULT '#64748b',-- hex; thin colored bar when scoped to this app
  public_base_url text,                        -- e.g. https://vigilia.app (for canonical_url construction)
  satellite_supabase_url text,                 -- the satellite's Supabase project URL (for cross-DB writes)
  -- service-role key is NEVER stored in DB; lives in vault/secrets and is referenced by name:
  satellite_service_key_secret_name text,      -- e.g. 'VIGILIA_SERVICE_ROLE_KEY'
  is_hub boolean NOT NULL DEFAULT false,       -- true for thecros only
  is_active boolean NOT NULL DEFAULT true,     -- false hides from switcher without deleting history
  display_order int NOT NULL DEFAULT 100,      -- for ordering in switcher; lower first
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federated_apps_active_order
  ON public.federated_apps (is_active, display_order, source_app);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.federated_apps_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
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


-- ── 2) RLS — admin/operator read; admin-only write ──────────────────────────
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


-- ── 3) Seed the federation ──────────────────────────────────────────────────
-- Accent colors are placeholders; user can edit any time via SQL or future admin UI.
-- service_key_secret_name fields are populated later via Lovable secret config.

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


-- ── 4) Convenience view: active apps in switcher order ─────────────────────
CREATE OR REPLACE VIEW public.federated_apps_active AS
  SELECT *
  FROM public.federated_apps
  WHERE is_active = true
  ORDER BY display_order, source_app;

GRANT SELECT ON public.federated_apps_active TO authenticated;

COMMIT;
