
-- ============================================
-- HubSpot Integration: Phase 1 — Database
-- ============================================

-- A) hubspot_connections
CREATE TABLE public.hubspot_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hubspot_portal_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  hubspot_mode text NOT NULL DEFAULT 'company',
  pipeline_id text,
  stage_mapping jsonb NOT NULL DEFAULT '{}',
  sync_direction text NOT NULL DEFAULT 'push',
  sync_scope jsonb NOT NULL DEFAULT '{"partners": true, "contacts": true, "journey_stage": true, "reflections": false, "tasks": true, "provisions": true}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_hubspot_connection()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'revoked', 'error') THEN
    RAISE EXCEPTION 'Invalid hubspot_connections.status: %', NEW.status;
  END IF;
  IF NEW.hubspot_mode NOT IN ('company', 'deal') THEN
    RAISE EXCEPTION 'Invalid hubspot_connections.hubspot_mode: %', NEW.hubspot_mode;
  END IF;
  IF NEW.sync_direction NOT IN ('push', 'push_pull') THEN
    RAISE EXCEPTION 'Invalid hubspot_connections.sync_direction: %', NEW.sync_direction;
  END IF;
  IF NEW.hubspot_mode = 'deal' AND NEW.pipeline_id IS NULL THEN
    RAISE EXCEPTION 'pipeline_id is required for deal mode';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_hubspot_connection
  BEFORE INSERT OR UPDATE ON public.hubspot_connections
  FOR EACH ROW EXECUTE FUNCTION public.validate_hubspot_connection();

CREATE TRIGGER trg_hubspot_connections_updated_at
  BEFORE UPDATE ON public.hubspot_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_hubspot_connections_user_id ON public.hubspot_connections(user_id);
CREATE INDEX idx_hubspot_connections_status ON public.hubspot_connections(status);

-- RLS
ALTER TABLE public.hubspot_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own connections"
  ON public.hubspot_connections FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can read all connections"
  ON public.hubspot_connections FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));


-- B) hubspot_field_mappings
CREATE TABLE public.hubspot_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.hubspot_connections(id) ON DELETE CASCADE,
  profunda_entity text NOT NULL,
  profunda_field text NOT NULL,
  hubspot_property text NOT NULL,
  direction text NOT NULL DEFAULT 'push',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_hubspot_field_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.direction NOT IN ('push', 'pull', 'both') THEN
    RAISE EXCEPTION 'Invalid hubspot_field_mappings.direction: %', NEW.direction;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_hubspot_field_mapping
  BEFORE INSERT OR UPDATE ON public.hubspot_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.validate_hubspot_field_mapping();

CREATE TRIGGER trg_hubspot_field_mappings_updated_at
  BEFORE UPDATE ON public.hubspot_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_hubspot_field_mappings_connection ON public.hubspot_field_mappings(connection_id);

ALTER TABLE public.hubspot_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own field mappings"
  ON public.hubspot_field_mappings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hubspot_connections c WHERE c.id = connection_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hubspot_connections c WHERE c.id = connection_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Admin can read all field mappings"
  ON public.hubspot_field_mappings FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));


-- C) hubspot_object_map
CREATE TABLE public.hubspot_object_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.hubspot_connections(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  provision_id uuid,
  hubspot_company_id text,
  hubspot_deal_id text,
  hubspot_contact_id text,
  last_synced_at timestamptz,
  last_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_hubspot_object_map_updated_at
  BEFORE UPDATE ON public.hubspot_object_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Partial unique indexes for idempotency
CREATE UNIQUE INDEX idx_hubspot_object_map_opp
  ON public.hubspot_object_map(connection_id, opportunity_id)
  WHERE opportunity_id IS NOT NULL AND contact_id IS NULL AND provision_id IS NULL;

CREATE UNIQUE INDEX idx_hubspot_object_map_contact
  ON public.hubspot_object_map(connection_id, contact_id)
  WHERE contact_id IS NOT NULL AND opportunity_id IS NULL AND provision_id IS NULL;

CREATE UNIQUE INDEX idx_hubspot_object_map_provision
  ON public.hubspot_object_map(connection_id, provision_id)
  WHERE provision_id IS NOT NULL AND opportunity_id IS NULL AND contact_id IS NULL;

CREATE INDEX idx_hubspot_object_map_connection ON public.hubspot_object_map(connection_id);
CREATE INDEX idx_hubspot_object_map_hs_company ON public.hubspot_object_map(hubspot_company_id) WHERE hubspot_company_id IS NOT NULL;
CREATE INDEX idx_hubspot_object_map_hs_deal ON public.hubspot_object_map(hubspot_deal_id) WHERE hubspot_deal_id IS NOT NULL;

ALTER TABLE public.hubspot_object_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own object mappings"
  ON public.hubspot_object_map FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hubspot_connections c WHERE c.id = connection_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hubspot_connections c WHERE c.id = connection_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Admin can read all object mappings"
  ON public.hubspot_object_map FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));


-- D) hubspot_sync_log
CREATE TABLE public.hubspot_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.hubspot_connections(id) ON DELETE CASCADE,
  direction text NOT NULL,
  entity text NOT NULL,
  profunda_id text,
  hubspot_id text,
  status text NOT NULL DEFAULT 'ok',
  message text,
  stats jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_hubspot_sync_log()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.direction NOT IN ('push', 'pull') THEN
    RAISE EXCEPTION 'Invalid hubspot_sync_log.direction: %', NEW.direction;
  END IF;
  IF NEW.status NOT IN ('ok', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'Invalid hubspot_sync_log.status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_hubspot_sync_log
  BEFORE INSERT OR UPDATE ON public.hubspot_sync_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_hubspot_sync_log();

CREATE INDEX idx_hubspot_sync_log_connection ON public.hubspot_sync_log(connection_id, created_at DESC);
CREATE INDEX idx_hubspot_sync_log_status ON public.hubspot_sync_log(status, created_at DESC);

ALTER TABLE public.hubspot_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sync logs"
  ON public.hubspot_sync_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hubspot_connections c WHERE c.id = connection_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Service role can insert sync logs"
  ON public.hubspot_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hubspot_connections c WHERE c.id = connection_id AND c.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
  );

CREATE POLICY "Admin can read all sync logs"
  ON public.hubspot_sync_log FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));


-- Register HubSpot scheduled sync in system_jobs (if table exists)
INSERT INTO public.system_jobs (key, name, description, owner, schedule, enabled)
VALUES ('hubspot_sync_daily', 'HubSpot Daily Sync', 'Pushes changed entities to HubSpot for all active connections', 'supabase', 'Daily at 6am UTC', true)
ON CONFLICT (key) DO NOTHING;
