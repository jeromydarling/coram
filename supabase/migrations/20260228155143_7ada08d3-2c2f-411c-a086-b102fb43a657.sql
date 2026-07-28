-- Add relational_focus to allowed action_types
ALTER TABLE public.onboarding_steps DROP CONSTRAINT onboarding_steps_action_type_check;
ALTER TABLE public.onboarding_steps ADD CONSTRAINT onboarding_steps_action_type_check 
  CHECK (action_type = ANY (ARRAY[
    'connect_email','connect_calendar','import_contacts','create_first_reflection',
    'add_event','enable_signum','connect_hubspot','join_communio','skip',
    'public_movement_opt_in','relational_focus'
  ]));