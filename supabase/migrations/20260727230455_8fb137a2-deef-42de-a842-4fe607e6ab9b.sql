-- Hourly scheduler for CROS notifications-tick edge function.
-- The tick itself is idempotent (per-recipient dedupe keys), safe to re-run.

DO $$
DECLARE
  fn_url text := 'https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/notifications-tick';
BEGIN
  -- Remove any prior schedule with the same name.
  PERFORM cron.unschedule('notifications-tick-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notifications-tick-hourly');

  PERFORM cron.schedule(
    'notifications-tick-hourly',
    '0 * * * *',
    format($cron$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('source','cron','at', now())
      );
    $cron$, fn_url)
  );
END $$;