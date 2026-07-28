-- Add overdue tasks notification preference
ALTER TABLE public.user_notification_settings
ADD COLUMN IF NOT EXISTS notify_overdue_tasks BOOLEAN NOT NULL DEFAULT true;

-- Add last notified timestamp to prevent duplicate daily alerts
ALTER TABLE public.user_notification_settings
ADD COLUMN IF NOT EXISTS last_overdue_tasks_notified_at TIMESTAMPTZ;