
-- Create weekly_reports table for director-level weekly briefs
CREATE TABLE public.weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_of_date DATE NOT NULL,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one report per user per week
CREATE UNIQUE INDEX idx_weekly_reports_user_week ON public.weekly_reports (user_id, week_of_date);

-- Index for fast lookups
CREATE INDEX idx_weekly_reports_created ON public.weekly_reports (created_at DESC);

-- Enable RLS
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Users can read their own reports
CREATE POLICY "Users can view their own weekly reports"
  ON public.weekly_reports FOR SELECT
  USING (auth.uid() = user_id);

-- Admin/leadership can view all reports
CREATE POLICY "Admin and leadership can view all weekly reports"
  ON public.weekly_reports FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- Service-role insert only (edge function uses service role)
CREATE POLICY "Service role can insert weekly reports"
  ON public.weekly_reports FOR INSERT
  WITH CHECK (true);

-- Service-role update  
CREATE POLICY "Service role can update weekly reports"
  ON public.weekly_reports FOR UPDATE
  USING (true);
