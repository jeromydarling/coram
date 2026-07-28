-- Fix remaining 4 Security Definer Views

-- opportunity_order_signals (referenced by FK relationships, careful)
DROP VIEW IF EXISTS public.opportunity_order_signals CASCADE;
CREATE VIEW public.opportunity_order_signals
WITH (security_invoker = true)
AS
SELECT o.id AS opportunity_id,
  max(oo.order_date) AS last_order_date,
  COALESCE(sum(CASE WHEN oo.order_date >= (CURRENT_DATE - 30) THEN oo.order_count ELSE 0 END), 0::bigint)::integer AS orders_last_30,
  COALESCE(sum(CASE WHEN oo.order_date >= (CURRENT_DATE - 90) THEN oo.order_count ELSE 0 END), 0::bigint)::integer AS orders_last_90
FROM opportunities o
LEFT JOIN opportunity_orders oo ON oo.opportunity_id = o.id
GROUP BY o.id;

-- profiles_public
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT id, user_id, display_name, timezone, is_approved, google_calendar_enabled, created_at, updated_at
FROM profiles;

-- resend_candidates_v1
DROP VIEW IF EXISTS public.resend_candidates_v1;
CREATE VIEW public.resend_candidates_v1
WITH (security_invoker = true)
AS
SELECT id, campaign_id, email, name, contact_id, opportunity_id,
  failure_category, failure_code, error_message, created_at
FROM email_campaign_audience eca
WHERE status = 'failed'
  AND COALESCE(failure_category, 'unknown') = ANY(ARRAY['provider_temp','quota','unknown'])
  AND COALESCE(failure_category, '') <> ALL(ARRAY['invalid_address','bounce','provider_perm'])
  AND (sent_at IS NULL OR sent_at < (now() - '24:00:00'::interval));

-- story_events_view
DROP VIEW IF EXISTS public.story_events_view;
CREATE VIEW public.story_events_view
WITH (security_invoker = true)
AS
SELECT id, opportunity_id, kind, title, summary, occurred_at, privacy_scope, author_id
FROM story_events_cache;
