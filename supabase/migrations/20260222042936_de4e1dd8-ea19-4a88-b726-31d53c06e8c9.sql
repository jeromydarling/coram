-- Performance indexes for Operator Nexus and feed queries

CREATE INDEX IF NOT EXISTS idx_living_system_signals_tenant_created
  ON living_system_signals (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_testimonium_events_tenant_occurred
  ON testimonium_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_workflow_created
  ON automation_runs (workflow_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communio_activity_log_tenant_created
  ON communio_activity_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_tenant_created
  ON activities (tenant_id, activity_date_time DESC);

-- Operator daily rollups table for cached aggregations
CREATE TABLE IF NOT EXISTS operator_rollups_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rollup_date date NOT NULL,
  rollup_key text NOT NULL,
  tenant_id uuid REFERENCES tenants(id),
  metrics jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rollup_date, rollup_key, tenant_id)
);

ALTER TABLE operator_rollups_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can read rollups"
  ON operator_rollups_daily FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "Service role can write rollups"
  ON operator_rollups_daily FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));
