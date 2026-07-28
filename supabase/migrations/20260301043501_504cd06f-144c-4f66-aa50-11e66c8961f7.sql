-- Add guide state columns to compass_user_state
ALTER TABLE public.compass_user_state
  ADD COLUMN IF NOT EXISTS guide_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guide_sections_seen text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.compass_user_state.guide_completed_at IS 'When the user dismissed the contextual guide permanently';
COMMENT ON COLUMN public.compass_user_state.guide_sections_seen IS 'Section IDs the guide has already shown to this user';