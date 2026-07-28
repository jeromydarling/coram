-- =====================================================================
-- CROS Federation — Phase 0
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cros_app_slug') THEN
    CREATE DOMAIN cros_app_slug AS text
      CHECK (VALUE ~ '^[a-z][a-z0-9-]{1,63}$');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.federation_apps (
  slug                       cros_app_slug PRIMARY KEY,
  display_name               text NOT NULL,
  tagline                    text,
  primary_domain             text,
  staging_domain             text,
  supabase_project_ref       text,
  status                     text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'paused', 'sunsetting', 'archived')),
  launched_at                timestamptz,
  has_content_engine         boolean NOT NULL DEFAULT false,
  has_lead_intake            boolean NOT NULL DEFAULT false,
  has_seo_module             boolean NOT NULL DEFAULT false,
  has_connect                boolean NOT NULL DEFAULT false,
  has_metro_pages            boolean NOT NULL DEFAULT false,
  has_constellation_node     boolean NOT NULL DEFAULT true,
  connect_revenue_share_pct  numeric(5,2)
                             CHECK (connect_revenue_share_pct IS NULL
                                    OR (connect_revenue_share_pct >= 0
                                        AND connect_revenue_share_pct <= 100)),
  content_publish_url        text,
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
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

CREATE TABLE IF NOT EXISTS public.gardener_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gardener_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.federated_audit (
  id           bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  source_app   text NOT NULL,
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email  text,
  action       text NOT NULL,
  resource     text,
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

CREATE TABLE IF NOT EXISTS public.notification_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app      text,
  event_type      text NOT NULL,
  channel         text NOT NULL DEFAULT 'email'
                  CHECK (channel IN ('email')),
  recipient       text NOT NULL,
  enabled         boolean NOT NULL DEFAULT true,
  filter_jsonb    jsonb NOT NULL DEFAULT '{}'::jsonb,
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

CREATE TABLE IF NOT EXISTS public.federation_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.federation_settings IS
  'Federation-wide configuration. Reachable from /operator/settings.';

INSERT INTO public.federation_settings (key, value, description)
VALUES
  ('analytics.default_measurement_id',
   '"G-RKF41M29QE"'::jsonb,
   'Default GA4 Measurement ID for the CROS Family property (526708699). Per-app overrides via analytics-config edge fn env vars.'),
  ('billing.platform_account',
   '"thecros"'::jsonb,
   'Slug of the app that hosts the platform Stripe account. Connect accounts live under satellite apps; take-rate flows here.')
ON CONFLICT (key) DO NOTHING;

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

ALTER TABLE public.federation_apps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gardener_grants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federated_audit      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_settings  ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS gardener_grants_self_read ON public.gardener_grants;
CREATE POLICY gardener_grants_self_read ON public.gardener_grants
  FOR SELECT TO authenticated
  USING (gardener_id = auth.uid() OR public.has_gardener_grant('*'));

DROP POLICY IF EXISTS gardener_grants_admin_write ON public.gardener_grants;
CREATE POLICY gardener_grants_admin_write ON public.gardener_grants
  FOR ALL TO authenticated
  USING (public.has_gardener_grant('*'))
  WITH CHECK (public.has_gardener_grant('*'));

DROP POLICY IF EXISTS federated_audit_read ON public.federated_audit;
CREATE POLICY federated_audit_read ON public.federated_audit
  FOR SELECT TO authenticated
  USING (public.has_gardener_grant(source_app));

DROP POLICY IF EXISTS federated_audit_insert ON public.federated_audit;
CREATE POLICY federated_audit_insert ON public.federated_audit
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS notification_rules_admin ON public.notification_rules;
CREATE POLICY notification_rules_admin ON public.notification_rules
  FOR ALL TO authenticated
  USING (public.has_gardener_grant('*'))
  WITH CHECK (public.has_gardener_grant('*'));

DROP POLICY IF EXISTS federation_settings_admin ON public.federation_settings;
CREATE POLICY federation_settings_admin ON public.federation_settings
  FOR ALL TO authenticated
  USING (public.has_gardener_grant('*'))
  WITH CHECK (public.has_gardener_grant('*'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
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