
-- 1. Set up pg_cron job to refresh materialized view every 6 hours
SELECT cron.schedule(
  'refresh_metro_momentum_signals',
  '0 */6 * * *',  -- Every 6 hours
  $$SELECT refresh_metro_momentum();$$
);

-- 2. Seed metro-to-state links for existing metros
-- First, get the Illinois state geo_group and link Chicago
INSERT INTO geo_group_metros (geo_group_id, metro_id)
SELECT gg.id, m.id
FROM geo_groups gg, metros m
WHERE gg.geo_group_id = 'IL' AND m.metro = 'Chicago'
ON CONFLICT (geo_group_id, metro_id) DO NOTHING;

-- Link Minneapolis-St. Paul to Minnesota
INSERT INTO geo_group_metros (geo_group_id, metro_id)
SELECT gg.id, m.id
FROM geo_groups gg, metros m
WHERE gg.geo_group_id = 'MN' AND m.metro = 'Minneapolis-St. Paul'
ON CONFLICT (geo_group_id, metro_id) DO NOTHING;

-- Link Lafayette-IN to Indiana
INSERT INTO geo_group_metros (geo_group_id, metro_id)
SELECT gg.id, m.id
FROM geo_groups gg, metros m
WHERE gg.geo_group_id = 'IN' AND m.metro = 'Lafayette-IN'
ON CONFLICT (geo_group_id, metro_id) DO NOTHING;

-- 3. Backfill existing first-anchor milestones
INSERT INTO metro_milestones (metro_id, milestone_type, achieved_at, anchor_id)
SELECT DISTINCT ON (a.metro_id)
  a.metro_id,
  'first_anchor',
  COALESCE(a.first_volume_date, a.agreement_signed_date)::timestamptz,
  a.id
FROM anchors a
WHERE a.metro_id IS NOT NULL 
  AND COALESCE(a.first_volume_date, a.agreement_signed_date) IS NOT NULL
ORDER BY a.metro_id, COALESCE(a.first_volume_date, a.agreement_signed_date) ASC
ON CONFLICT (metro_id, milestone_type) DO NOTHING;

-- 4. Refresh the materialized view now to pick up any milestone changes
SELECT refresh_metro_momentum();
