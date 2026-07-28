# Phase 3D — QA Checklist

## Tables Created
- `people_roster_snapshots` — roster JSON per opportunity per run
- `people_roster_diffs` — diff (added/removed/changed) per opportunity per run
- `event_attendance` — org↔event attendance records

## Unique Constraints (Idempotency)
```sql
-- Verify unique indexes exist
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('people_roster_snapshots', 'people_roster_diffs', 'event_attendance', 'proactive_notifications')
  AND indexdef LIKE '%UNIQUE%';
```

## RLS Verification
```sql
-- All Phase 3D tables have RLS enabled, SELECT-only policies
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('people_roster_snapshots', 'people_roster_diffs', 'event_attendance');

-- Verify no INSERT/UPDATE/DELETE policies for authenticated users
SELECT schemaname, tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('people_roster_snapshots', 'people_roster_diffs', 'event_attendance');
```

## Dedupe Verification
```sql
-- Proactive notifications dedupe index
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'proactive_notifications' AND indexname LIKE '%dedupe%';

-- Check for duplicate notifications (should be 0)
SELECT user_id, notification_type, payload->>'dedupe_key', count(*)
FROM proactive_notifications
WHERE payload->>'dedupe_key' IS NOT NULL
GROUP BY 1, 2, 3
HAVING count(*) > 1;
```

## People Roster Snapshot Integrity
```sql
-- No duplicate snapshots per (opportunity, run)
SELECT opportunity_id, run_id, count(*)
FROM people_roster_snapshots
GROUP BY 1, 2
HAVING count(*) > 1;

-- No duplicate diffs per (opportunity, run)
SELECT opportunity_id, run_id, count(*)
FROM people_roster_diffs
GROUP BY 1, 2
HAVING count(*) > 1;
```

## Event Attendance Integrity
```sql
-- No duplicate attendance per (opportunity, event)
SELECT opportunity_id, event_discovered_item_id, count(*)
FROM event_attendance
GROUP BY 1, 2
HAVING count(*) > 1;
```

## Edge Functions Deployed
- `people-roster-diff` ✅
- `event-coattendance` ✅
- `notifications-generate` ✅
- `discovery-cron` ✅
- `discovery-callback` (updated) ✅

## Test Results (59/59 pass)
- discovery-callback: 11 tests
- discovery-dispatch: 11 tests
- event-coattendance: 10 tests
- notifications-generate: 4 tests
- people-roster-diff: 23 tests

## Scheduling
Discovery-cron supports `{ "job": "daily" }` and `{ "job": "weekly" }`.
Configure via pg_cron or Supabase scheduled function:
- Daily 07:00 UTC: `POST /functions/v1/discovery-cron { "job": "daily" }`
- Weekly Monday 06:00 UTC: `POST /functions/v1/discovery-cron { "job": "weekly" }`
