
-- B1/B2: Add failure categorization columns to email_campaign_audience
ALTER TABLE public.email_campaign_audience
  ADD COLUMN IF NOT EXISTS failure_category text,
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS failure_raw text;

-- B1: Campaign subject stats table
CREATE TABLE IF NOT EXISTS public.campaign_subject_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL,
  subject text NOT NULL,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_stats_user_subject
  ON public.campaign_subject_stats (created_by, subject);

CREATE INDEX IF NOT EXISTS idx_subject_stats_last_used
  ON public.campaign_subject_stats (last_used_at DESC);

-- RLS for campaign_subject_stats
ALTER TABLE public.campaign_subject_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subject stats"
  ON public.campaign_subject_stats FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Service role can manage subject stats"
  ON public.campaign_subject_stats FOR ALL
  USING (true)
  WITH CHECK (true);

-- B3: Resend candidates view
CREATE OR REPLACE VIEW public.resend_candidates_v1 AS
SELECT
  eca.id,
  eca.campaign_id,
  eca.email,
  eca.name,
  eca.contact_id,
  eca.opportunity_id,
  eca.failure_category,
  eca.failure_code,
  eca.error_message,
  eca.created_at
FROM public.email_campaign_audience eca
WHERE eca.status = 'failed'
  AND COALESCE(eca.failure_category, 'unknown') IN ('provider_temp', 'quota', 'unknown')
  AND COALESCE(eca.failure_category, '') NOT IN ('invalid_address', 'bounce', 'provider_perm')
  AND (eca.sent_at IS NULL OR eca.sent_at < now() - interval '24 hours');

-- Index for failure_category queries
CREATE INDEX IF NOT EXISTS idx_audience_failure_category
  ON public.email_campaign_audience (campaign_id, status, failure_category)
  WHERE status = 'failed';
