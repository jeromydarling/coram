
-- ============================================
-- Phase F(B): Insights & Actions tables
-- ============================================

-- 1) org_insights
CREATE TABLE public.org_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  confidence numeric NOT NULL DEFAULT 0.6,
  summary text NOT NULL,
  explanation text NULL,
  explanation_model text NULL,
  explanation_tokens_in int NULL,
  explanation_tokens_out int NULL,
  source jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'converted', 'archived')),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: one insight per type per org per day
CREATE UNIQUE INDEX uq_org_insights_type_day
  ON public.org_insights (org_id, insight_type, generated_date);

CREATE INDEX idx_org_insights_org_generated
  ON public.org_insights (org_id, generated_at DESC);

CREATE INDEX idx_org_insights_status_generated
  ON public.org_insights (status, generated_at DESC);

CREATE TRIGGER set_org_insights_updated_at
  BEFORE UPDATE ON public.org_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and leadership can read all org_insights"
  ON public.org_insights FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Users with metro access can read org_insights"
  ON public.org_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_insights.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "Authenticated users can insert org_insights"
  ON public.org_insights FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'warehouse_manager'));

CREATE POLICY "Authenticated users can update org_insights"
  ON public.org_insights FOR UPDATE
  USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'warehouse_manager'));


-- 2) org_recommended_actions
CREATE TABLE public.org_recommended_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  insight_id uuid NOT NULL REFERENCES public.org_insights(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  cta_label text NOT NULL,
  cta_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_org_actions_insight_type
  ON public.org_recommended_actions (insight_id, action_type);

CREATE INDEX idx_org_actions_org_status
  ON public.org_recommended_actions (org_id, status, created_at DESC);

CREATE TRIGGER set_org_actions_updated_at
  BEFORE UPDATE ON public.org_recommended_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_recommended_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and leadership can read all org_recommended_actions"
  ON public.org_recommended_actions FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Users with metro access can read org_recommended_actions"
  ON public.org_recommended_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_recommended_actions.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "Authenticated users can insert org_recommended_actions"
  ON public.org_recommended_actions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'warehouse_manager'));

CREATE POLICY "Authenticated users can update org_recommended_actions"
  ON public.org_recommended_actions FOR UPDATE
  USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'warehouse_manager'));


-- 3) org_action_feedback
CREATE TABLE public.org_action_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  action_type text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('completed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_feedback_org_type
  ON public.org_action_feedback (org_id, action_type, created_at DESC);

ALTER TABLE public.org_action_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and leadership can read all org_action_feedback"
  ON public.org_action_feedback FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Authenticated users can insert org_action_feedback"
  ON public.org_action_feedback FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'warehouse_manager'));
