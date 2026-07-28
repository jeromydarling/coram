-- Add welcome_dismissed_at to profiles for first-login overlay tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS welcome_dismissed_at timestamptz DEFAULT NULL;