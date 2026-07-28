-- Remove legacy pcsforpeople.com default from ignored_email_domains column
ALTER TABLE public.ai_user_settings
  ALTER COLUMN ignored_email_domains SET DEFAULT ARRAY[]::text[];