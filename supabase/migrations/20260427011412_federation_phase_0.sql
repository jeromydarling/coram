-- =====================================================================
-- CROS Federation — Phase 0
-- =====================================================================
-- Lays the foundation for the federated Operator Console:
--   1. federation_apps      — registry of every app in the CROS family
--   2. gardener_grants      — per-gardener access scoped by source_app
--   3. federated_audit      — cross-app audit log
--   4. notification_rules   — email-only routing (Slack out of scope v1)
--   5. federation_settings  — kv config for the federation hub
--
-- Plus: prepare existing content tables for federation by adding the
-- source_app discriminator column. This enables Content Phase 1
-- (collapse vigilia + resurrectio clones into thecros) without any
-- further DDL.
--
-- See: CROS_FEDERATED_CONSOLE_PLAN.md, CROS_CONTENT_CONSOLIDATION_PLAN.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------

-- Canonical list of apps in the federation. Source of truth for the
-- `source_app` discriminator across federated tables. Keep in sync with
-- KNOWN_SOURCE_APPS in the universal-lead-intake edge fn (allowlist of 17).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cros_app_slug') THEN
    -- Use a domain rather than enum so we can add new apps without
    -- ALTER TYPE migrations. Enforced at app layer + via federation_apps FK.
    CREATE DOMAIN cros_app_slug AS text
      CHECK (VALUE ~ '^[a-z][a-z0-9-]{1,63}$');
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 1. federation_apps — the registry
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.federation_apps (
  -- Identity
  slug                       cros_app_slug PRIMARY KEY,
  display_name               text NOT NULL,
  tagline                    text,

  -- Routing
  primary_domain             text,            -- e.g. 'thecros.app'
  staging_domain             text,
  supabase_project_ref       text,            -- e.g. 'abcd1234' (for cross-project queries)

  -- Lifecycle
  status                     text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'paused', 'sunsetting', 'archived')),
  launched_at                timestamptz,

  -- Capability flags (drives which federated modules light up for this app)
  has_content_engine         boolean NOT NULL DEFAULT false,
  has_lead_intake            boolean NOT NULL DEFAULT false,
  has_seo_module             boolean NOT NULL DEFAULT false,
  has_connect                boolean NOT NULL DEFAULT false,
  has_metro_pages            boolean NOT NULL DEFAULT false,
  has_constellation_node     boolean NOT NULL DEFAULT true,

  -- Stripe Connect (per-tenant Connect accounts living under satellite apps)
  -- Platform Stripe = CROS. This is the take-rate the platform keeps from
  -- Connect transactions on this app.
  connect_revenue_share_pct  numeric(5,2)
                             CHECK (connect_revenue_share_pct IS NULL
                                    OR (connect_revenue_share_pct >= 0
                                        AND connect_revenue_share_pct <= 100)),

  -- Content publish bridge (pull-through Edge Function URL on the satellite
  -- that reads federated content for its own slug). Null until the
  -- satellite ships the content-fetch fn (see content plan §5.4).
  content_publish_url        text,

  -- Free-form metadata (icons, theme colors, owner contacts, etc.)
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  created_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_federation_apps_status
  ON public.federation_apps (status);
CREATE INDEX IF NOT EXISTS idx_federation_apps_has_lead_intake
  ON public.federation_apps (has_lead_intake) WHERE has_lead_intake = true;
CREATE INDEX IF NOT EXISTS idx_federation_apps_has_content
  ON public.federation_apps (has_content_engine) WHERE has_content_engine = true;
CREATE INDEX IF NOT EXISTS idx_federation_apps_has_connect
  ON public.federation_apps (has_connect) WHERE has_connect = true;

COMMENT ON TABLE public.federation_apps IS
  'Registry of every app in the CROS family. Drives the Operator Console app switcher and capability flags.';

-- ---------------------------------------------------------------------
-- 2. gardener_grants — per-gardener access scoped by source_app
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gardener_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gardener_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- '*' means access to all apps (Gardener-of-the-federation).
  -- Otherwise must match an active federation_apps.slug.
  source_app   text NOT NULL,
  role         text NOT NULL DEFAULT 'gardener'
               CHECK (role IN ('gardener', 'editor', 'viewer', 'support')),
  granted_at   timestamptz NOT NULL DEFAULT now(),
  granted_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at   timestamptz,
  notes        text,
  UNIQUE (gardener_id, source_app, role)
);

CREATE INDEX IF NOT EXISTS idx_gardener_grants_gardener
  ON public.gardener_grants (gardener_id);
CREATE INDEX IF NOT EXISTS idx_gardener_grants_app
  ON public.gardener_grants (source_app);

COMMENT ON TABLE public.gardener_grants IS
  'Authorizes a gardener to read/write federated data scoped to one or more apps. source_app = ''*'' grants federation-wide access.';

-- Helper: does the current user have a grant for this app?
CREATE OR REPLACE FUNCTION public.has_gardener_grant(p_source_app text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gardener_grants g
    WHERE g.gardener_id = auth.uid()
      AND (g.expires_at IS NULL OR g.expires_at > now())
      AND (g.source_app = p_source_app OR g.source_app = '*')
  );
$$;

COMMENT ON FUNCTION public.has_gardener_grant IS
  'Returns true if auth.uid() has a non-expired gardener_grant for the given source_app (or a wildcard grant).';

-- ---------------------------------------------------------------------
-- 3. federated_audit — cross-app audit log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.federated_audit (
  id           bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  source_app   text NOT NULL,
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email  text,
  action       text NOT NULL,            -- e.g. 'lead.create', 'content.publish'
  resource     text,                     -- e.g. 'inbound_leads:abc-123'
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           inet,
  user_agent   text
);

CREATE INDEX IF NOT EXISTS idx_federated_audit_app_time
  ON public.federated_audit (source_app, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_federated_audit_actor_time
  ON public.federated_audit (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_federated_audit_action
  ON public.federated_audit (action);

COMMENT ON TABLE public.federated_audit IS
  'Append-only log of significant actions across the federation. Surfaced in /operator/audit.';

-- ---------------------------------------------------------------------
-- 4. notification_rules — email-only v1
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app      text,                  -- null = applies to all apps
  event_type      text NOT NULL,         -- e.g. 'lead.created', 'audit.high_severity'
  channel         text NOT NULL DEFAULT 'email'
                  CHECK (channel IN ('email')),  -- locked to email per user 2026-04-26
  recipient       text NOT NULL,         -- email address
  enabled         boolean NOT NULL DEFAULT true,
  filter_jsonb    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- additional match criteria
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_event
  ON public.notification_rules (event_type) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_notification_rules_app
  ON public.notification_rules (source_app) WHERE enabled = true;

COMMENT ON TABLE public.notification_rules IS
  'Email-only routing rules for federation events. Slack intentionally excluded in v1.';

-- ---------------------------------------------------------------------
-- 5. federation_settings — kv config
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.federation_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.federation_settings IS
  'Federation-wide configuration. Reachable from /operator/settings.';

-- Seed: default GA Measurement ID fallback (Schola). Override per-app via
-- the analytics-config edge fn env vars.
INSERT INTO public.federation_settings (key, value, description)
VALUES
  ('analytics.default_measurement_id',
   '"G-RKF41M29QE"'::jsonb,
   'Default GA4 Measurement ID for the CROS Family property (526708699). Per-app overrides via analytics-config edge fn env vars.'),
  ('billing.platform_account',
   '"thecros"'::jsonb,
   'Slug of the app that hosts the platform Stripe account. Connect accounts live under satellite apps; take-rate flows here.')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Seed the registry with the 17 known apps
-- ---------------------------------------------------------------------
-- KNOWN_SOURCE_APPS allowlist from universal-lead-intake edge fn.
-- Capability flags are best-guess defaults; refine via /operator/apps.
INSERT INTO public.federation_apps (slug, display_name, primary_domain,
                                    has_content_engine, has_lead_intake,
                                    has_seo_module, has_metro_pages,
                                    has_constellation_node, status)
VALUES
  ('thecros',             'CROS',                     'thecros.app',           true,  true, true,  true,  true, 'active'),
  ('theschola',           'The Schola',               'theschola.app',         false, true, true,  false, true, 'active'),
  ('hortus',              'Hortus',                   'hortus.app',            true,  true, false, false, true, 'active'),
  ('refugium',            'Refugium',                 'refugium.app',          false, true, false, false, true, 'active'),
  ('resurrectio',         'Resurrectio',              'resurrectio.app',       true,  true, false, false, true, 'active'),
  ('transitus',           'Transitus',                'transitus.app',         true,  true, false, false, true, 'active'),
  ('vigilia',             'Vigilia',                  'vigilia.app',           true,  true, false, false, true, 'active'),
  ('communis',            'Communis',                 'communis.app',          true,  true, false, false, true, 'active'),
  ('propria',             'Propria',                  'propria.app',           false, true, false, false, true, 'active'),
  ('cormundum',           'Cor Mundum',               'cormundum.app',         false, true, false, false, true, 'active'),
  ('bitoku',              'Bitoku',                   'bitoku.app',            true,  true, true,  false, true, 'active'),
  ('rehearso',            'Rehearso',                 'rehearso.app',          false, true, false, false, true, 'active'),
  ('heritage-kitchen',    'Heritage Kitchen',         'heritage-kitchen.app',  false, true, false, false, true, 'active'),
  ('via-publica',         'Via Publica',              'via-publica.app',       false, true, false, false, true, 'active'),
  ('fabrica-forge',       'Fabrica Forge',            'fabrica-forge.app',     true,  true, false, false, true, 'active'),
  ('catholic-insurance',  'Catholic Insurance',       'catholic-insurance.app',false, true, false, false, true, 'active'),
  ('vrtmethod',           'VRT Method',               'vrtmethod.app',         false, true, false, false, true, 'active')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. Prepare content tables for federation (Content Plan Phase 1 prep)
-- ---------------------------------------------------------------------
-- Adding source_app columns now is cheap and unblocks Phase 1 (collapse
-- vigilia + resurrectio clones). Default 'thecros' so existing rows are
-- attributed correctly. NOT NULL enforced after backfill.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'operator_content_drafts') THEN
    ALTER TABLE public.operator_content_drafts
      ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'thecros';
    CREATE INDEX IF NOT EXISTS idx_operator_content_drafts_source_app
      ON public.operator_content_drafts (source_app);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'operator_rss_sources') THEN
    ALTER TABLE public.operator_rss_sources
      ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'thecros';
    -- Also add the bitoku-derived feed category column we plan to lift in
    -- Content Plan Phase 5 (Gap #2). Cheap to add now.
    ALTER TABLE public.operator_rss_sources
      ADD COLUMN IF NOT EXISTS category text;
    CREATE INDEX IF NOT EXISTS idx_operator_rss_sources_source_app
      ON public.operator_rss_sources (source_app);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'operator_rss_items') THEN
    ALTER TABLE public.operator_rss_items
      ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'thecros';
    CREATE INDEX IF NOT EXISTS idx_operator_rss_items_source_app
      ON public.operator_rss_items (source_app);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'narrative_stories') THEN
    ALTER TABLE public.narrative_stories
      ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'thecros';
    CREATE INDEX IF NOT EXISTS idx_narrative_stories_source_app
      ON public.narrative_stories (source_app);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'public_metro_pages') THEN
    ALTER TABLE public.public_metro_pages
      ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'thecros';
    CREATE INDEX IF NOT EXISTS idx_public_metro_pages_source_app
      ON public.public_metro_pages (source_app);
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 8. Tenants: source_app + stripe_connect_account_id
-- ---------------------------------------------------------------------
-- Per Stripe Connect topology: tenants can be customers of any satellite
-- app. Add discriminator + Connect linkage. Both nullable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    ALTER TABLE public.tenants
      ADD COLUMN IF NOT EXISTS source_app text;
    ALTER TABLE public.tenants
      ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
    CREATE INDEX IF NOT EXISTS idx_tenants_source_app
      ON public.tenants (source_app);
    CREATE INDEX IF NOT EXISTS idx_tenants_stripe_connect
      ON public.tenants (stripe_connect_account_id)
      WHERE stripe_connect_account_id IS NOT NULL;
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 9. RLS — federation tables
-- ---------------------------------------------------------------------
ALTER TABLE public.federation_apps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gardener_grants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federated_audit      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_settings  ENABLE ROW LEVEL SECURITY;

-- federation_apps: any authenticated gardener (any grant) can read; only
-- federation-wide gardeners ('*') can write.
DROP POLICY IF EXISTS federation_apps_read ON public.federation_apps;
CREATE POLICY federation_apps_read ON public.federation_apps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gardener_grants g
      WHERE g.gardener_id = auth.uid()
        AND (g.expires_at IS NULL OR g.expires_at > now())
    )
  );

DROP POLICY IF EXISTS federation_apps_write ON public.federation_apps;
CREATE POLICY federation_apps_write ON public.federation_apps
  FOR ALL TO authenticated
  USING (public.has_gardener_grant('*'))
  WITH CHECK (public.has_gardener_grant('*'));

-- gardener_grants: a gardener can see their own grants; '*' gardeners
-- can see and manage all grants.
DROP POLICY IF EXISTS gardener_grants_self_read ON public.gardener_grants;
CREATE POLICY gardener_grants_self_read ON public.gardener_grants
  FOR SELECT TO authenticated
  USING (gardener_id = auth.uid() OR public.has_gardener_grant('*'));

DROP POLICY IF EXISTS gardener_grants_admin_write ON public.gardener_grants;
CREATE POLICY gardener_grants_admin_write ON public.gardener_grants
  FOR ALL TO authenticated
  USING (public.has_gardener_grant('*'))
  WITH CHECK (public.has_gardener_grant('*'));

-- federated_audit: read scoped to apps the gardener can access; insert
-- allowed for any authenticated user (audit is append-only, written by
-- edge functions and triggers).
DROP POLICY IF EXISTS federated_audit_read ON public.federated_audit;
CREATE POLICY federated_audit_read ON public.federated_audit
  FOR SELECT TO authenticated
  USING (public.has_gardener_grant(source_app));

DROP POLICY IF EXISTS federated_audit_insert ON public.federated_audit;
CREATE POLICY federated_audit_insert ON public.federated_audit
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- notification_rules: '*' gardeners only (federation-level config).
DROP POLICY IF EXISTS notification_rules_admin ON public.notification_rules;
CREATE POLICY notification_rules_admin ON public.notification_rules
  FOR ALL TO authenticated
  USING (public.has_gardener_grant('*'))
  WITH CHECK (public.has_gardener_grant('*'));

-- federation_settings: '*' gardeners only.
DROP POLICY IF EXISTS federation_settings_admin ON public.federation_settings;
CREATE POLICY federation_settings_admin ON public.federation_settings
  FOR ALL TO authenticated
  USING (public.has_gardener_grant('*'))
  WITH CHECK (public.has_gardener_grant('*'));

-- ---------------------------------------------------------------------
-- 10. Updated-at trigger for mutable tables
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_federation_apps_updated_at ON public.federation_apps;
CREATE TRIGGER trg_federation_apps_updated_at
  BEFORE UPDATE ON public.federation_apps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notification_rules_updated_at ON public.notification_rules;
CREATE TRIGGER trg_notification_rules_updated_at
  BEFORE UPDATE ON public.notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_federation_settings_updated_at ON public.federation_settings;
CREATE TRIGGER trg_federation_settings_updated_at
  BEFORE UPDATE ON public.federation_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- End Phase 0
-- =====================================================================
