
-- =============================================
-- Phase F3: Outcome Tracking + Feedback Loops
-- =============================================

-- 1) org_action_outcomes — append-only source of truth
CREATE TABLE public.org_action_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  action_id uuid NOT NULL REFERENCES public.org_recommended_actions(id) ON DELETE CASCADE,
  outcome_type text NOT NULL CHECK (outcome_type IN ('completed', 'ignored', 'successful', 'unsuccessful', 'needs_followup')),
  notes text,
  recorded_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Exactly one outcome per action
ALTER TABLE public.org_action_outcomes
  ADD CONSTRAINT uq_org_action_outcomes_action_id UNIQUE (action_id);

CREATE INDEX idx_org_action_outcomes_org ON public.org_action_outcomes (org_id, created_at DESC);

-- RLS
ALTER TABLE public.org_action_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_action_outcomes_select"
  ON public.org_action_outcomes FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_action_outcomes.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "org_action_outcomes_insert"
  ON public.org_action_outcomes FOR INSERT
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'warehouse_manager')
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
      OR EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = org_action_outcomes.org_id
          AND public.has_metro_access(auth.uid(), o.metro_id)
      )
    )
  );

-- No UPDATE or DELETE policies (append-only)

-- 2) org_insight_effectiveness_v — derived read-only view
CREATE OR REPLACE VIEW public.org_insight_effectiveness_v AS
SELECT
  i.id AS insight_id,
  i.org_id,
  i.insight_type,
  COUNT(DISTINCT a.id) AS actions_created,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed') AS actions_completed,
  COUNT(DISTINCT o.id) FILTER (WHERE o.outcome_type = 'successful') AS actions_successful,
  COUNT(DISTINCT o.id) FILTER (WHERE o.outcome_type = 'unsuccessful') AS actions_unsuccessful,
  CASE
    WHEN COUNT(DISTINCT o.id) FILTER (WHERE o.outcome_type IN ('successful', 'unsuccessful')) = 0 THEN NULL
    ELSE ROUND(
      COUNT(DISTINCT o.id) FILTER (WHERE o.outcome_type = 'successful')::numeric
      / NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.outcome_type IN ('successful', 'unsuccessful')), 0)
      * 100, 1
    )
  END AS success_rate
FROM public.org_insights i
LEFT JOIN public.org_recommended_actions a ON a.insight_id = i.id
LEFT JOIN public.org_action_outcomes o ON o.action_id = a.id
GROUP BY i.id, i.org_id, i.insight_type;
