
CREATE OR REPLACE VIEW public.ecosystem_garden_pulse_view
WITH (security_invoker = true) AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  t.archetype,
  t.home_metro_id,
  t.familia_id,
  t.status,
  m.metro as metro_name,
  m.state_code as metro_state,
  COALESCE(te.event_count, 0) as recent_event_count,
  COALESCE(ls.signal_count, 0) as recent_signal_count,
  COALESCE(act.activity_count, 0) as recent_activity_count
FROM public.tenants t
LEFT JOIN public.metros m ON m.id = t.home_metro_id
LEFT JOIN LATERAL (
  SELECT count(*)::int as event_count
  FROM public.testimonium_events tev
  WHERE tev.tenant_id = t.id
    AND tev.created_at >= now() - interval '30 days'
) te ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int as signal_count
  FROM public.living_system_signals lss
  WHERE lss.tenant_id = t.id
    AND lss.created_at >= now() - interval '30 days'
) ls ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int as activity_count
  FROM public.activities a
  WHERE a.tenant_id = t.id
    AND a.activity_date_time::timestamptz >= now() - interval '30 days'
    AND a.activity_type IN ('Visit', 'Project')
) act ON true
WHERE t.status = 'active';
