
-- Set up pg_cron scheduling for discovery runs
-- Weekly Monday 12:00 UTC (7am ET)
SELECT cron.schedule(
  'discovery-weekly',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/discovery-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode":"weekly"}'::jsonb
  );
  $$
);

-- Daily at 11:00 UTC (6am ET) for urgent event detection
SELECT cron.schedule(
  'discovery-daily-events',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/discovery-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode":"daily"}'::jsonb
  );
  $$
);
