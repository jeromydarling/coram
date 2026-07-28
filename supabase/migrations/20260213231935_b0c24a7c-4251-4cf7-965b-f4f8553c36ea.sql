-- Add 'relationship_action_high_priority' to proactive_notifications notification_type CHECK
ALTER TABLE public.proactive_notifications
  DROP CONSTRAINT IF EXISTS proactive_notifications_notification_type_check;

ALTER TABLE public.proactive_notifications
  ADD CONSTRAINT proactive_notifications_notification_type_check
  CHECK (notification_type IN (
    'momentum_spike',
    'upcoming_event',
    'leadership_change',
    'threshold_crossing',
    'relationship_action_high_priority'
  ));