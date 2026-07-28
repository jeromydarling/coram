-- Drop the legacy system_error_events table.
--
-- Runtime errors are now captured and surfaced exclusively through Sentry
-- (see the sentry-issues-proxy edge function and src/lib/sentry/queryCounts.ts).
-- All former readers — operator analytics rollups, Vigilia awareness summaries,
-- the Rhythm/Analytics/Stability operator pages, and the Compass session engine —
-- have been repointed to Sentry, so this table is no longer written to or read from.
--
-- CASCADE removes any dependent objects (views, policies, grants) that referenced it.
DROP TABLE IF EXISTS public.system_error_events CASCADE;
