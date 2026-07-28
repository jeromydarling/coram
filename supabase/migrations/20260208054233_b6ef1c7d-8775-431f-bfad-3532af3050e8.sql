
-- Fix security definer view: set to SECURITY INVOKER
CREATE OR REPLACE VIEW public.org_insight_effectiveness_v
WITH (security_invoker = true)
AS
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
