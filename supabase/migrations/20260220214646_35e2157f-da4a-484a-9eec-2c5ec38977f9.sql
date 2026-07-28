
-- ═══════════════════════════════════════════════════════
-- PHASE 8: Operator Work Queue + Communio Governance Flags
-- ═══════════════════════════════════════════════════════

-- Part 2: Operator Work Queue
CREATE TABLE IF NOT EXISTS public.operator_work_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'activation_pending',
    'connector_issue',
    'migration_stalled',
    'expansion_signal',
    'communio_request'
  )),
  summary text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.operator_work_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to work queue"
  ON public.operator_work_queue
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_work_queue_status ON public.operator_work_queue(status, created_at DESC);
CREATE INDEX idx_work_queue_type ON public.operator_work_queue(type);

-- Part 4: Communio Governance Flags
CREATE TABLE IF NOT EXISTS public.communio_governance_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.communio_groups(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN ('excessive_sharing', 'suspicious_pattern')),
  details text,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

ALTER TABLE public.communio_governance_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to governance flags"
  ON public.communio_governance_flags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_governance_flags_status ON public.communio_governance_flags(status, created_at DESC);

-- Part 5: Extend operator_tenant_stats (add columns if they don't exist)
DO $$ BEGIN
  ALTER TABLE public.operator_tenant_stats ADD COLUMN IF NOT EXISTS monthly_revenue_cents integer DEFAULT 0;
  ALTER TABLE public.operator_tenant_stats ADD COLUMN IF NOT EXISTS addon_count integer DEFAULT 0;
  ALTER TABLE public.operator_tenant_stats ADD COLUMN IF NOT EXISTS guided_activation_count integer DEFAULT 0;
  ALTER TABLE public.operator_tenant_stats ADD COLUMN IF NOT EXISTS expansion_count integer DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
