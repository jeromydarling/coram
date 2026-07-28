
-- Fix org_action_history_v: use hypothesis instead of summary
CREATE OR REPLACE VIEW public.org_action_history_v AS
SELECT
  a.org_id,
  a.id AS action_id,
  a.action_type,
  a.source,
  a.hypothesis AS action_summary,
  a.status AS action_status,
  a.created_at AS action_created_at,
  a.executed_at,
  o.outcome_type,
  o.observed_at,
  o.confidence AS outcome_confidence
FROM public.org_actions a
LEFT JOIN public.org_campaign_outcomes o ON o.action_id = a.id
ORDER BY a.created_at DESC;
