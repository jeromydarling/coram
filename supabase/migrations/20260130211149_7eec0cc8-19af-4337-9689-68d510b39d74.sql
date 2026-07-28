-- Add ignored email domains column to ai_user_settings
ALTER TABLE public.ai_user_settings 
ADD COLUMN IF NOT EXISTS ignored_email_domains text[] NOT NULL DEFAULT ARRAY['pcsforpeople.com'];

-- Update existing rows to have the default
UPDATE public.ai_user_settings 
SET ignored_email_domains = ARRAY['pcsforpeople.com']
WHERE ignored_email_domains IS NULL OR ignored_email_domains = '{}';