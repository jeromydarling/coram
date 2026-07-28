-- Add timezone column to profiles table
ALTER TABLE public.profiles
ADD COLUMN timezone TEXT DEFAULT 'America/Chicago';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.timezone IS 'User timezone detected at signup or set manually';