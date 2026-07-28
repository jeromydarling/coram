-- Make rationale truly optional (nullable) on send intents
ALTER TABLE public.email_campaign_send_intents
  ALTER COLUMN rationale DROP NOT NULL,
  ALTER COLUMN rationale SET DEFAULT NULL;