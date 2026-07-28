ALTER TABLE public.operator_content_drafts
  ADD COLUMN IF NOT EXISTS voice_calibrated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_calibrated_at timestamptz;