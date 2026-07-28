
-- Phase 21AC fix: Add public_movement_opt_in to action_type check and insert steps

-- Drop and recreate the check constraint to include the new action type
ALTER TABLE public.onboarding_steps DROP CONSTRAINT IF EXISTS onboarding_steps_action_type_check;
ALTER TABLE public.onboarding_steps ADD CONSTRAINT onboarding_steps_action_type_check 
  CHECK (action_type IN ('connect_email','connect_calendar','import_contacts','create_first_reflection','add_event','enable_signum','connect_hubspot','join_communio','skip','public_movement_opt_in'));

-- Now insert the onboarding steps
INSERT INTO public.onboarding_steps (key, archetype, order_index, title, description, action_type, optional) VALUES
  ('public_movement_opt_in', 'church', 7, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'workforce_development', 6, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'housing', 5, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'education', 5, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'government', 5, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'social_enterprise', 6, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'nonprofit_program', 5, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'community_foundation', 6, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true),
  ('public_movement_opt_in', 'public_library_or_city_program', 5, 'Help grow the constellation of care', 'Contribute anonymous movement signals to the wider constellation.', 'public_movement_opt_in', true)
ON CONFLICT DO NOTHING;
