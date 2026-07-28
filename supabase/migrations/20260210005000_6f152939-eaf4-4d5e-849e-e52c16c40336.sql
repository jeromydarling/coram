
-- Create search_intent_profiles table
CREATE TABLE public.search_intent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL UNIQUE,
  required_all text[] NOT NULL DEFAULT '{}',
  required_any text[] NOT NULL DEFAULT '{}',
  blocked_patterns text[] NOT NULL DEFAULT '{}',
  enforced_suffix text NOT NULL DEFAULT '',
  scope_mode text NOT NULL DEFAULT 'national' CHECK (scope_mode IN ('metro', 'national')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_search_intent_profiles_module ON public.search_intent_profiles (module) WHERE active = true;

-- Updated_at trigger
CREATE TRIGGER update_search_intent_profiles_updated_at
  BEFORE UPDATE ON public.search_intent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.search_intent_profiles ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users
CREATE POLICY "Authenticated users can read active profiles"
  ON public.search_intent_profiles
  FOR SELECT
  USING (auth.role() = 'authenticated' AND active = true);

-- Only admins can modify (via service role typically, but protect anyway)
CREATE POLICY "Admins can manage intent profiles"
  ON public.search_intent_profiles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed defaults
INSERT INTO public.search_intent_profiles (module, required_all, required_any, blocked_patterns, enforced_suffix, scope_mode)
VALUES
  ('grant', 
   ARRAY['grant'], 
   ARRAY[]::text[], 
   ARRAY['-grant','not grant','without grant','exclude grant','non-grant'], 
   'grant',
   'national'),
  ('event', 
   ARRAY[]::text[], 
   ARRAY['event','conference','summit','webinar','workshop','expo','symposium'], 
   ARRAY['-event','not event','without event','exclude conference'], 
   '(event OR conference OR summit OR webinar OR workshop OR expo OR symposium)',
   'national'),
  ('opportunity', 
   ARRAY[]::text[], 
   ARRAY['organization','company','nonprofit','foundation','employer','firm','startup'], 
   ARRAY['-company','not nonprofit','exclude organization'], 
   '(organization OR company OR nonprofit OR foundation OR employer OR firm OR startup)',
   'national');

-- Also add enforced_query column to search_runs if not present
ALTER TABLE public.search_runs ADD COLUMN IF NOT EXISTS raw_query text;
ALTER TABLE public.search_runs ADD COLUMN IF NOT EXISTS enforced_query text;
