
ALTER TABLE public.inbound_leads
  ADD COLUMN IF NOT EXISTS source_app text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_page text,
  ADD COLUMN IF NOT EXISTS form_variant text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS lead_kind text,
  ADD COLUMN IF NOT EXISTS interest text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS extra jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new';

CREATE UNIQUE INDEX IF NOT EXISTS inbound_leads_dedupe_key_uidx
  ON public.inbound_leads (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS inbound_leads_source_app_idx ON public.inbound_leads (source_app);
CREATE INDEX IF NOT EXISTS inbound_leads_created_at_idx ON public.inbound_leads (created_at DESC);
