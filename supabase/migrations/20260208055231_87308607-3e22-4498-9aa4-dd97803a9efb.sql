
-- =============================================
-- Phase F4: Action Outcome Loop + Campaign Intelligence
-- =============================================

-- 1) org_actions — first-class canonical actions
CREATE TABLE public.org_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('gmail_campaign', 'manual_outreach', 'note_only')),
  source text NOT NULL CHECK (source IN ('watchlist', 'enrichment', 'opportunity_monitor', 'manual', 'suggestion')),
  source_ref_id uuid NULL,
  hypothesis text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'executed', 'aborted'))
);

CREATE INDEX idx_org_actions_org ON public.org_actions (org_id, created_at DESC);
CREATE INDEX idx_org_actions_source_ref ON public.org_actions (source_ref_id) WHERE source_ref_id IS NOT NULL;
-- Idempotency: one action per source_ref_id+action_type combo
CREATE UNIQUE INDEX uq_org_actions_source_ref ON public.org_actions (source_ref_id, action_type) WHERE source_ref_id IS NOT NULL;

ALTER TABLE public.org_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_actions_select" ON public.org_actions FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_actions.org_id AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "org_actions_insert" ON public.org_actions FOR INSERT
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'warehouse_manager')
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
      OR EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = org_actions.org_id AND public.has_metro_access(auth.uid(), o.metro_id)
      )
    )
  );

-- 2) org_campaign_outcomes — campaign-specific ground truth (separate from F3 org_action_outcomes)
CREATE TABLE public.org_campaign_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.org_actions(id) ON DELETE CASCADE,
  outcome_type text NOT NULL CHECK (outcome_type IN ('reply', 'click', 'meeting', 'ignore', 'bounce', 'unsubscribe')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_campaign_outcomes_action ON public.org_campaign_outcomes (action_id, outcome_type);
-- No duplicate outcomes per action + outcome_type pair
CREATE UNIQUE INDEX uq_org_campaign_outcomes_action_type ON public.org_campaign_outcomes (action_id, outcome_type);

ALTER TABLE public.org_campaign_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_campaign_outcomes_select" ON public.org_campaign_outcomes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_actions oa
      WHERE oa.id = org_campaign_outcomes.action_id
        AND (
          public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
          OR EXISTS (
            SELECT 1 FROM public.opportunities o
            WHERE o.id = oa.org_id AND public.has_metro_access(auth.uid(), o.metro_id)
          )
        )
    )
  );

CREATE POLICY "org_campaign_outcomes_insert" ON public.org_campaign_outcomes FOR INSERT
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'warehouse_manager')
    AND EXISTS (
      SELECT 1 FROM public.org_actions oa
      WHERE oa.id = org_campaign_outcomes.action_id
        AND (
          public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
          OR EXISTS (
            SELECT 1 FROM public.opportunities o
            WHERE o.id = oa.org_id AND public.has_metro_access(auth.uid(), o.metro_id)
          )
        )
    )
  );

-- 3) campaign_suggestion_decisions — ranking/suppression audit trail
CREATE TABLE public.campaign_suggestion_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.campaign_suggestions(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('shown', 'suppressed', 'boosted')),
  reason text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_campaign_suggestion_decisions ON public.campaign_suggestion_decisions (suggestion_id);
CREATE INDEX idx_campaign_suggestion_decisions_eval ON public.campaign_suggestion_decisions (evaluated_at DESC);

ALTER TABLE public.campaign_suggestion_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_suggestion_decisions_select" ON public.campaign_suggestion_decisions FOR SELECT
  USING (
    NOT public.has_role(auth.uid(), 'warehouse_manager')
  );

CREATE POLICY "campaign_suggestion_decisions_insert" ON public.campaign_suggestion_decisions FOR INSERT
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'warehouse_manager')
  );

-- 4) Materialized view: org_action_effectiveness_mv
CREATE MATERIALIZED VIEW public.org_action_effectiveness_mv AS
SELECT
  oa.org_id,
  oa.action_type,
  oa.source,
  COUNT(DISTINCT oa.id) AS total_actions,
  COUNT(DISTINCT oa.id) FILTER (WHERE oco.outcome_type IN ('reply', 'click', 'meeting')) AS successful_actions,
  CASE
    WHEN COUNT(DISTINCT oa.id) = 0 THEN 0
    ELSE ROUND(
      COUNT(DISTINCT oa.id) FILTER (WHERE oco.outcome_type IN ('reply', 'click', 'meeting'))::numeric
      / COUNT(DISTINCT oa.id), 3
    )
  END AS success_rate,
  ROUND(AVG(oco.confidence) FILTER (WHERE oco.outcome_type IN ('reply', 'click', 'meeting')), 2) AS avg_confidence,
  MAX(oco.observed_at) FILTER (WHERE oco.outcome_type IN ('reply', 'click', 'meeting')) AS last_success_at
FROM public.org_actions oa
LEFT JOIN public.org_campaign_outcomes oco ON oco.action_id = oa.id
WHERE oa.status = 'executed'
GROUP BY oa.org_id, oa.action_type, oa.source;

CREATE UNIQUE INDEX ON public.org_action_effectiveness_mv (org_id, action_type, source);

-- 5) Backfill: create org_actions rows from sent campaigns
-- Note: campaigns may not have opportunity_ids, so we handle nulls
INSERT INTO public.org_actions (org_id, action_type, source, source_ref_id, executed_at, status)
SELECT DISTINCT
  COALESCE(eca.opportunity_id, ec.id) AS org_id,
  'gmail_campaign',
  'manual',
  ec.id,
  COALESCE(MIN(eca.sent_at), ec.created_at) AS executed_at,
  'executed'
FROM public.email_campaigns ec
LEFT JOIN public.email_campaign_audience eca ON eca.campaign_id = ec.id
WHERE ec.status = 'sent'
GROUP BY ec.id, ec.created_at, eca.opportunity_id
ON CONFLICT DO NOTHING;

-- Backfill bounce outcomes from failed campaign audience
INSERT INTO public.org_campaign_outcomes (action_id, outcome_type, observed_at, confidence, metadata)
SELECT DISTINCT
  oa.id,
  'bounce',
  COALESCE(eca.sent_at, now()),
  0.9,
  jsonb_build_object('campaign_id', ec.id, 'failure_category', eca.failure_category)
FROM public.email_campaigns ec
JOIN public.email_campaign_audience eca ON eca.campaign_id = ec.id AND eca.status = 'failed'
JOIN public.org_actions oa ON oa.source_ref_id = ec.id AND oa.action_type = 'gmail_campaign'
WHERE eca.failure_category IN ('bounce', 'invalid_address')
ON CONFLICT DO NOTHING;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.org_action_effectiveness_mv;

-- Helper function to refresh materialized view
CREATE OR REPLACE FUNCTION public.refresh_action_effectiveness()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.org_action_effectiveness_mv;
END;
$$;
