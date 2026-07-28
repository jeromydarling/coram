
-- ═══════════════════════════════════════════════════════
-- PART 1: activity_impact table (lightweight impact snapshots)
-- ═══════════════════════════════════════════════════════

CREATE TABLE public.activity_impact (
  activity_id uuid PRIMARY KEY REFERENCES public.activities(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  people_helped integer,
  attendance_count integer,
  outcome_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_impact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant impact"
  ON public.activity_impact FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own tenant impact"
  ON public.activity_impact FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own tenant impact"
  ON public.activity_impact FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════
-- PART 2: Testimonium rollup columns for projects
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.testimonium_rollups
  ADD COLUMN IF NOT EXISTS projects_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_notes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS people_helped_sum integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS helpers_involved_count integer NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════
-- PART 3: Add 'good_work_pulse' to communio shared signals
-- (no schema change needed — signal_type is text)
-- ═══════════════════════════════════════════════════════

-- Index for fast project-scoped impact lookups
CREATE INDEX IF NOT EXISTS idx_activity_impact_tenant
  ON public.activity_impact(tenant_id);
