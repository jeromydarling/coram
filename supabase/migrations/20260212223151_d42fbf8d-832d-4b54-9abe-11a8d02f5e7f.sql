ALTER TABLE public.user_notification_settings
  ADD COLUMN notify_meeting_notes boolean NOT NULL DEFAULT true;