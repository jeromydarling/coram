select cron.schedule(
  'cros-onboarding-drip-tick',
  '7 * * * *',
  $$
  select net.http_post(
    url:='https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/onboarding-drip-tick',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);