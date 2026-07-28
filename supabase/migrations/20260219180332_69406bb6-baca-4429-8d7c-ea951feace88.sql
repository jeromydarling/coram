
-- ============================================================
-- Phase 7K: CROS Governance Spine Tables
-- ============================================================

-- 1) communio_group_metrics — weekly aggregation per group
CREATE TABLE public.communio_group_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  tenant_count int NOT NULL DEFAULT 0,
  signals_shared_count int NOT NULL DEFAULT 0,
  events_shared_count int NOT NULL DEFAULT 0,
  collaboration_levels jsonb NOT NULL DEFAULT '{}',
  week_start date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, week_start)
);

ALTER TABLE public.communio_group_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read communio_group_metrics"
  ON public.communio_group_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert communio_group_metrics"
  ON public.communio_group_metrics FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update communio_group_metrics"
  ON public.communio_group_metrics FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role bypass for edge function writes
CREATE POLICY "Service role full access communio_group_metrics"
  ON public.communio_group_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) communio_activity_log — behavioral audit (no content)
CREATE TABLE public.communio_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL,
  action_type text NOT NULL,
  sharing_level text,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_communio_action_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF NEW.action_type NOT IN ('joined', 'left', 'shared_signal', 'shared_event', 'changed_level') THEN
    RAISE EXCEPTION 'Invalid action_type: %', NEW.action_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_communio_action_type
  BEFORE INSERT OR UPDATE ON public.communio_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_communio_action_type();

CREATE INDEX idx_communio_activity_log_group_created
  ON public.communio_activity_log (group_id, created_at DESC);

ALTER TABLE public.communio_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read communio_activity_log"
  ON public.communio_activity_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert communio_activity_log"
  ON public.communio_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access communio_activity_log"
  ON public.communio_activity_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) nri_usage_metrics — weekly NRI usage per tenant
CREATE TABLE public.nri_usage_metrics (
  tenant_id uuid NOT NULL,
  week_start date NOT NULL,
  signals_generated int NOT NULL DEFAULT 0,
  signals_shared_to_communio int NOT NULL DEFAULT 0,
  reflections_triggered int NOT NULL DEFAULT 0,
  testimonium_flags_generated int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, week_start)
);

CREATE INDEX idx_nri_usage_metrics_week ON public.nri_usage_metrics (week_start DESC);

ALTER TABLE public.nri_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read nri_usage_metrics"
  ON public.nri_usage_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert nri_usage_metrics"
  ON public.nri_usage_metrics FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update nri_usage_metrics"
  ON public.nri_usage_metrics FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access nri_usage_metrics"
  ON public.nri_usage_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
