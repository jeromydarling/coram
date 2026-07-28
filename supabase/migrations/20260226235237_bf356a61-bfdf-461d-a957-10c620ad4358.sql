
-- =============================================
-- Sync Conflicts table for bi-directional sync
-- Flag-for-review conflict resolution strategy
-- =============================================

CREATE TABLE public.sync_conflicts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connector_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  external_id text NOT NULL,
  cros_data jsonb NOT NULL DEFAULT '{}',
  remote_data jsonb NOT NULL DEFAULT '{}',
  conflicting_fields text[] NOT NULL DEFAULT '{}',
  resolution text NOT NULL DEFAULT 'pending',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for resolution status
CREATE OR REPLACE FUNCTION public.validate_sync_conflict()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.resolution NOT IN ('pending', 'accept_cros', 'accept_remote', 'merged', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid sync_conflicts resolution: %', NEW.resolution;
  END IF;
  IF NEW.entity_type NOT IN ('account', 'contact', 'task', 'event', 'activity', 'stage') THEN
    RAISE EXCEPTION 'Invalid sync_conflicts entity_type: %', NEW.entity_type;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_validate_sync_conflict
  BEFORE INSERT OR UPDATE ON public.sync_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.validate_sync_conflict();

-- Indexes
CREATE INDEX idx_sync_conflicts_tenant ON public.sync_conflicts(tenant_id);
CREATE INDEX idx_sync_conflicts_pending ON public.sync_conflicts(tenant_id, resolution) WHERE resolution = 'pending';
CREATE INDEX idx_sync_conflicts_connector ON public.sync_conflicts(connector_key, external_id);

-- RLS
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their sync conflicts"
  ON public.sync_conflicts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = sync_conflicts.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Stewards can manage sync conflicts"
  ON public.sync_conflicts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.tenant_id = sync_conflicts.tenant_id
        AND tu.user_id = auth.uid()
        AND ur.role = 'steward'
    )
  );

-- Sync direction tracking on existing connector config
-- Tracks which connectors support outbound sync
CREATE TABLE public.sync_direction_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connector_key text NOT NULL,
  sync_direction text NOT NULL DEFAULT 'inbound',
  outbound_entities text[] NOT NULL DEFAULT '{}',
  webhook_url text,
  delta_token text,
  last_outbound_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connector_key)
);

CREATE OR REPLACE FUNCTION public.validate_sync_direction()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.sync_direction NOT IN ('inbound', 'outbound', 'bidirectional') THEN
    RAISE EXCEPTION 'Invalid sync_direction: %', NEW.sync_direction;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_validate_sync_direction
  BEFORE INSERT OR UPDATE ON public.sync_direction_config
  FOR EACH ROW EXECUTE FUNCTION public.validate_sync_direction();

ALTER TABLE public.sync_direction_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view sync direction config"
  ON public.sync_direction_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = sync_direction_config.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Stewards can manage sync direction config"
  ON public.sync_direction_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.tenant_id = sync_direction_config.tenant_id
        AND tu.user_id = auth.uid()
        AND ur.role = 'steward'
    )
  );
