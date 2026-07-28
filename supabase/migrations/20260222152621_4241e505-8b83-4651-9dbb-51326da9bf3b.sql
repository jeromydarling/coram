
-- Part 1: vigilia_signals table
CREATE TABLE IF NOT EXISTS public.vigilia_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  context_ref uuid,
  suggested_action text NOT NULL,
  role_scope text NOT NULL DEFAULT 'steward',
  is_hipaa_sensitive boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for type
CREATE OR REPLACE FUNCTION public.validate_vigilia_signal_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN (
    'visit_without_followup', 'partner_silence_gap', 'activity_dropoff',
    'volunteer_gap', 'reflection_without_action', 'event_followup_missing',
    'friction_idle_detected', 'narrative_surge_detected'
  ) THEN
    RAISE EXCEPTION 'Invalid vigilia_signals type: %', NEW.type;
  END IF;
  IF NEW.severity NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid vigilia_signals severity: %', NEW.severity;
  END IF;
  IF NEW.status NOT IN ('open', 'acted', 'dismissed', 'archived') THEN
    RAISE EXCEPTION 'Invalid vigilia_signals status: %', NEW.status;
  END IF;
  IF NEW.role_scope NOT IN ('shepherd', 'companion', 'visitor', 'steward') THEN
    RAISE EXCEPTION 'Invalid vigilia_signals role_scope: %', NEW.role_scope;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_vigilia_signal_type_trigger
  BEFORE INSERT OR UPDATE ON public.vigilia_signals
  FOR EACH ROW EXECUTE FUNCTION public.validate_vigilia_signal_type();

-- Indexes
CREATE INDEX idx_vigilia_signals_tenant_status ON public.vigilia_signals (tenant_id, status);
CREATE INDEX idx_vigilia_signals_type ON public.vigilia_signals (type);
CREATE INDEX idx_vigilia_signals_created ON public.vigilia_signals (created_at);

-- RLS
ALTER TABLE public.vigilia_signals ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own signals
CREATE POLICY "vigilia_signals_tenant_read" ON public.vigilia_signals
  FOR SELECT USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Tenants can update status (act/dismiss) on their own signals
CREATE POLICY "vigilia_signals_tenant_update" ON public.vigilia_signals
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  ) WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Admins can read all (for operator summary)
CREATE POLICY "vigilia_signals_admin_read" ON public.vigilia_signals
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
  );

-- Service role insert (edge function only)
CREATE POLICY "vigilia_signals_service_insert" ON public.vigilia_signals
  FOR INSERT WITH CHECK (true);

-- Part 2: Add anonymized_summary to living_system_signals
ALTER TABLE public.living_system_signals
  ADD COLUMN IF NOT EXISTS anonymized_summary text;

-- Part 3: Operator aggregation view
CREATE OR REPLACE VIEW public.operator_vigilia_summary AS
SELECT
  tenant_id,
  type AS signal_type,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS count_last_7d,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS count_last_30d,
  CASE
    WHEN COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') >
         COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') * 0.5
    THEN 'rising'
    WHEN COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') <
         COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') * 0.2
    THEN 'falling'
    ELSE 'stable'
  END AS trend_direction
FROM public.vigilia_signals
WHERE status != 'archived'
GROUP BY tenant_id, type;

-- Part 4: Cleanup function for archived signals > 60 days
CREATE OR REPLACE FUNCTION public.cleanup_vigilia_signals()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM vigilia_signals
  WHERE status = 'archived' AND created_at < now() - interval '60 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Also auto-archive dismissed signals older than 14 days
  UPDATE vigilia_signals SET status = 'archived'
  WHERE status = 'dismissed' AND created_at < now() - interval '14 days';
  
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
END;
$$;
