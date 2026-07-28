
-- ============================================================
-- Phase F2: org_insight_generation_locks + org_tasks
-- ============================================================

-- A) Debounce lock table
CREATE TABLE public.org_insight_generation_locks (
  org_id uuid PRIMARY KEY REFERENCES public.opportunities(id) ON DELETE CASCADE,
  last_triggered_at timestamptz NOT NULL DEFAULT now(),
  last_inputs_hash text NULL,
  lock_until timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_insight_generation_locks ENABLE ROW LEVEL SECURITY;

-- Only service role writes to this (edge functions with service key)
-- Authenticated users can read for debugging
CREATE POLICY "Authenticated users can read insight gen locks"
  ON public.org_insight_generation_locks FOR SELECT TO authenticated
  USING (true);

-- B) org_tasks table
CREATE TABLE public.org_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dismissed')),
  due_at timestamptz NULL,
  created_by uuid NOT NULL,
  source jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_tasks_org_status ON public.org_tasks (org_id, status, created_at DESC);

ALTER TABLE public.org_tasks ENABLE ROW LEVEL SECURITY;

-- RLS: metro-scoped access (mirrors org visibility)
CREATE POLICY "Users can read org tasks for accessible metros"
  ON public.org_tasks FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_tasks.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "Users can insert org tasks for accessible metros"
  ON public.org_tasks FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'warehouse_manager')
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
      OR EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = org_tasks.org_id
          AND public.has_metro_access(auth.uid(), o.metro_id)
      )
    )
  );

CREATE POLICY "Users can update org tasks for accessible metros"
  ON public.org_tasks FOR UPDATE TO authenticated
  USING (
    NOT public.has_role(auth.uid(), 'warehouse_manager')
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
      OR EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = org_tasks.org_id
          AND public.has_metro_access(auth.uid(), o.metro_id)
      )
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_org_tasks_updated_at
  BEFORE UPDATE ON public.org_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add generated_date column to org_insights for proper unique constraint
-- (If it doesn't exist yet from the previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_insights' AND column_name = 'generated_date'
  ) THEN
    ALTER TABLE public.org_insights ADD COLUMN generated_date date NOT NULL DEFAULT CURRENT_DATE;
    CREATE UNIQUE INDEX idx_org_insights_idempotent ON public.org_insights (org_id, insight_type, generated_date);
  END IF;
END $$;
