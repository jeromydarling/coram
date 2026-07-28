
-- Add familia_sharing_enabled to tenant_provision_settings
ALTER TABLE public.tenant_provision_settings
  ADD COLUMN IF NOT EXISTS familia_sharing_enabled boolean NOT NULL DEFAULT false;

-- Create aggregated rollup view (SECURITY INVOKER — respects RLS)
-- Aggregates care-related activities across Familia members who opted in.
-- HAVING >= 2 distinct tenants ensures no single tenant is identifiable.
CREATE OR REPLACE VIEW public.familia_provision_rollups
WITH (security_invoker = true) AS
SELECT
  t.familia_id,
  a.metro_id,
  date_trunc('month', a.activity_date_time)::date AS period,
  a.activity_type::text AS resource_category,
  count(*)::int AS care_count,
  count(DISTINCT a.contact_id)::int AS participants_count
FROM public.activities a
JOIN public.tenants t ON t.id = a.tenant_id
JOIN public.tenant_provision_settings tps ON tps.tenant_id = t.id
WHERE t.familia_id IS NOT NULL
  AND tps.familia_sharing_enabled = true
  AND a.activity_date_time >= (now() - interval '6 months')
GROUP BY t.familia_id, a.metro_id, date_trunc('month', a.activity_date_time)::date, a.activity_type
HAVING count(DISTINCT a.tenant_id) >= 2;
