
-- Fix SECURITY DEFINER views by recreating with security_invoker = true
DROP VIEW IF EXISTS public.usage_daily_by_org;
DROP VIEW IF EXISTS public.usage_by_workflow;
DROP VIEW IF EXISTS public.usage_by_unit;

CREATE VIEW public.usage_daily_by_org
WITH (security_invoker = true)
AS
SELECT
  org_id,
  (occurred_at AT TIME ZONE 'UTC')::date AS usage_date,
  event_type,
  unit,
  SUM(quantity) AS total_quantity,
  COUNT(*) AS event_count
FROM public.usage_events
GROUP BY org_id, (occurred_at AT TIME ZONE 'UTC')::date, event_type, unit;

CREATE VIEW public.usage_by_workflow
WITH (security_invoker = true)
AS
SELECT
  workflow_key,
  event_type,
  unit,
  SUM(quantity) AS total_quantity,
  COUNT(*) AS event_count,
  MIN(occurred_at) AS first_event,
  MAX(occurred_at) AS last_event
FROM public.usage_events
GROUP BY workflow_key, event_type, unit;

CREATE VIEW public.usage_by_unit
WITH (security_invoker = true)
AS
SELECT
  unit,
  event_type,
  SUM(quantity) AS total_quantity,
  COUNT(*) AS event_count,
  (occurred_at AT TIME ZONE 'UTC')::date AS usage_date
FROM public.usage_events
GROUP BY unit, event_type, (occurred_at AT TIME ZONE 'UTC')::date;
