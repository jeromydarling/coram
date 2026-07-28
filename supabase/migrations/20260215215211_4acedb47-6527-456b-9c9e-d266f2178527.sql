
-- Fix story_events_view to use security_invoker (explicit)
CREATE OR REPLACE VIEW public.story_events_view
WITH (security_invoker = true)
AS

-- Reflections
SELECT
  'reflection:' || r.id AS id,
  r.opportunity_id,
  'reflection'::text AS kind,
  'Reflection'::text AS title,
  LEFT(regexp_replace(r.body, '<[^>]*>', '', 'g'), 280) AS summary,
  r.created_at AS occurred_at,
  r.visibility AS privacy_scope,
  r.author_id
FROM public.opportunity_reflections r

UNION ALL

-- Emails (metadata only)
SELECT
  'email:' || e.id AS id,
  c.opportunity_id,
  'email'::text AS kind,
  COALESCE(NULLIF(e.subject, ''), LEFT(COALESCE(e.snippet, '(no subject)'), 60)) AS title,
  LEFT(COALESCE(e.snippet, ''), 280) AS summary,
  e.sent_at AS occurred_at,
  'private'::text AS privacy_scope,
  e.user_id AS author_id
FROM public.email_communications e
JOIN public.contacts c ON c.id = e.contact_id
WHERE c.opportunity_id IS NOT NULL

UNION ALL

-- Campaign touches
SELECT
  'campaign:' || a.campaign_id || '-' || a.id AS id,
  a.opportunity_id,
  'campaign'::text AS kind,
  COALESCE(ec.name, 'Campaign') AS title,
  'Subject: ' || COALESCE(ec.subject, 'N/A') || ' — ' || COALESCE(a.status, 'sent') AS summary,
  a.sent_at AS occurred_at,
  'team'::text AS privacy_scope,
  NULL::uuid AS author_id
FROM public.email_campaign_audience a
JOIN public.email_campaigns ec ON ec.id = a.campaign_id
WHERE a.opportunity_id IS NOT NULL

UNION ALL

-- Tasks
SELECT
  'task:' || ra.id AS id,
  ra.opportunity_id,
  'task'::text AS kind,
  'Task: ' || COALESCE(ra.title, 'Untitled') AS title,
  COALESCE(ra.summary, '') AS summary,
  ra.created_at AS occurred_at,
  'team'::text AS privacy_scope,
  NULL::uuid AS author_id
FROM public.relationship_actions ra;
