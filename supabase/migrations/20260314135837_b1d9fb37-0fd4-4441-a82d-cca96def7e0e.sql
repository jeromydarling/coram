
-- Part 2: Add follow_up_date to opportunity_reflections
ALTER TABLE public.opportunity_reflections
  ADD COLUMN IF NOT EXISTS follow_up_date date DEFAULT NULL;

-- Part 3: Add new milestone life event types
-- (milestone already exists in code; add sub-types as values in life_events table is flexible with event_type text column)
-- No schema change needed for milestone types since event_type is text.

-- Part 4: Add retreat_center to archetypes table
INSERT INTO public.archetypes (key, name, description, default_tier, default_flags, default_journey_stages, default_keywords)
VALUES (
  'retreat_center',
  'Retreat Center',
  'Retreat centers host moments that change lives — CROS helps remember the people who return.',
  'core',
  '{"voluntarium": true, "provisio": false, "signum": true, "testimonium": false, "impulsus": false, "relatio": false}'::jsonb,
  '["Inquiry", "Registered", "Retreatant", "Returning Guest", "Spiritual Companion", "Community Friend"]'::jsonb,
  '["retreat center", "silent retreat", "parish retreat", "youth retreat", "spiritual direction", "formation event", "guest speakers"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
