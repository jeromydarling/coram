
-- Extend proactive_notifications CHECK to include expansion types
ALTER TABLE public.proactive_notifications
  DROP CONSTRAINT IF EXISTS proactive_notifications_notification_type_check;

ALTER TABLE public.proactive_notifications
  ADD CONSTRAINT proactive_notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'momentum_spike'::text,
    'upcoming_event'::text,
    'leadership_change'::text,
    'threshold_crossing'::text,
    'relationship_action_high_priority'::text,
    'relationship_story_update'::text,
    'discovery_event'::text,
    'discovery_grant'::text,
    'discovery_people'::text,
    'metro_narrative_update'::text,
    'provision_assigned'::text,
    'provision_message'::text,
    'provision_tracking_added'::text,
    'provision_delivery_update'::text,
    'provision_status_changed'::text,
    'expansion_presence'::text,
    'expansion_stage_changed'::text
  ]));

-- Seed notification type config for expansion types
INSERT INTO public.notification_type_config (event_type, enabled, default_on, admin_only, description) VALUES
  ('expansion_presence', true, true, false, 'Gentle notification when first presence is detected in a new metro'),
  ('expansion_stage_changed', true, true, false, 'Gentle notification when expansion activation stage progresses')
ON CONFLICT (event_type) DO NOTHING;
