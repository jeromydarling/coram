
-- Add 'people' to search_runs search_type CHECK constraint
ALTER TABLE public.search_runs DROP CONSTRAINT search_runs_search_type_check;
ALTER TABLE public.search_runs ADD CONSTRAINT search_runs_search_type_check 
  CHECK (search_type = ANY (ARRAY['event'::text, 'opportunity'::text, 'grant'::text, 'people'::text]));

-- Add people intent profile
INSERT INTO public.search_intent_profiles (module, required_all, required_any, blocked_patterns, enforced_suffix, scope_mode, active)
VALUES (
  'people',
  '{}',
  ARRAY['director', 'manager', 'coordinator', 'specialist', 'officer', 'leader', 'executive', 'president', 'CEO', 'founder'],
  ARRAY['-person', 'not people', 'exclude person'],
  '(director OR manager OR coordinator OR specialist OR officer OR leader OR executive)',
  'national',
  true
)
ON CONFLICT (module) DO UPDATE SET
  required_any = EXCLUDED.required_any,
  blocked_patterns = EXCLUDED.blocked_patterns,
  enforced_suffix = EXCLUDED.enforced_suffix,
  scope_mode = EXCLUDED.scope_mode,
  active = EXCLUDED.active;
