
-- Add dashboard_mode preference to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_mode text NOT NULL DEFAULT 'operational';

-- Add check constraint
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_dashboard_mode_check
  CHECK (dashboard_mode IN ('operational', 'story'));
