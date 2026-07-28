
-- ═══════════════════════════════════════════════════════
-- Phase 21AB: Restoration Narrative Layer
-- ═══════════════════════════════════════════════════════

-- restoration_signals — calm narrative signals generated when entities are restored
CREATE TABLE public.restoration_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  source_entity_type text NOT NULL,
  restoration_type text NOT NULL,
  narrative_weight text NOT NULL DEFAULT 'low',
  source_event_ids text[] DEFAULT '{}',
  visible_scope text NOT NULL DEFAULT 'tenant_only',
  created_by_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_restoration_signal()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.restoration_type NOT IN (
    'relationship_restored','voice_returned','work_reopened','care_recovered','structure_restored'
  ) THEN
    RAISE EXCEPTION 'Invalid restoration_type: %', NEW.restoration_type;
  END IF;
  IF NEW.narrative_weight NOT IN ('low','medium') THEN
    RAISE EXCEPTION 'Invalid narrative_weight: %', NEW.narrative_weight;
  END IF;
  IF NEW.visible_scope NOT IN ('tenant_only','familia_aggregate','communio_aggregate') THEN
    RAISE EXCEPTION 'Invalid visible_scope: %', NEW.visible_scope;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_restoration_signal
  BEFORE INSERT OR UPDATE ON public.restoration_signals
  FOR EACH ROW EXECUTE FUNCTION public.validate_restoration_signal();

-- Indexes
CREATE INDEX idx_restoration_signals_tenant ON public.restoration_signals(tenant_id, created_at DESC);
CREATE INDEX idx_restoration_signals_type ON public.restoration_signals(restoration_type);

-- RLS
ALTER TABLE public.restoration_signals ENABLE ROW LEVEL SECURITY;

-- Tenant members can read their own tenant signals
CREATE POLICY "Tenant members read own restoration signals"
  ON public.restoration_signals FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- Gardener (admin) can read all
CREATE POLICY "Admin read all restoration signals"
  ON public.restoration_signals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- System insert only (service role)
CREATE POLICY "Service role insert restoration signals"
  ON public.restoration_signals FOR INSERT
  WITH CHECK (created_by_system = true);

-- Cleanup function (90 day retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_restoration_signals()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM restoration_signals WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
END; $$;
