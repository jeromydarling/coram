
-- Add metro_id and ai_generated columns to testimonium_reports
ALTER TABLE public.testimonium_reports
  ADD COLUMN IF NOT EXISTS metro_id uuid REFERENCES public.metros(id),
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT true;

-- Index on metro_id
CREATE INDEX IF NOT EXISTS idx_testimonium_reports_metro_created
  ON public.testimonium_reports (metro_id, created_at DESC);
