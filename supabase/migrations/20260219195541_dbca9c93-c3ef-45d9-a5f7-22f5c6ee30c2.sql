
-- Phase 7Q: Self-Serve Customer Success Layer

-- 1. onboarding_sessions
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  archetype text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  current_step text NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz NULL,
  UNIQUE(tenant_id)
);

ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read own onboarding sessions"
  ON public.onboarding_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = onboarding_sessions.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Service role insert onboarding sessions"
  ON public.onboarding_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = onboarding_sessions.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Service role update onboarding sessions"
  ON public.onboarding_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = onboarding_sessions.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2. onboarding_steps (static config)
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  key text NOT NULL,
  archetype text NOT NULL,
  order_index int NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('connect_email','connect_calendar','import_contacts','create_first_reflection','add_event','enable_signum','connect_hubspot','join_communio','skip')),
  optional boolean DEFAULT false,
  PRIMARY KEY (key, archetype)
);

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read onboarding steps"
  ON public.onboarding_steps FOR SELECT TO authenticated
  USING (true);

-- Seed onboarding steps for each archetype
INSERT INTO public.onboarding_steps (key, archetype, order_index, title, description, action_type, optional) VALUES
  -- Church
  ('connect_email', 'church', 1, 'Connect Your Email', 'Bring your conversations into relationship memory.', 'connect_email', false),
  ('connect_calendar', 'church', 2, 'Connect Your Calendar', 'Let CROS see your meetings and visits.', 'connect_calendar', true),
  ('create_first_reflection', 'church', 3, 'Write Your First Reflection', 'A short note about someone you serve.', 'create_first_reflection', false),
  ('add_event', 'church', 4, 'Add a Community Event', 'A service, outreach, or gathering.', 'add_event', false),
  ('enable_signum', 'church', 5, 'Enable Local Signals', 'Start discovering what''s happening in your community.', 'enable_signum', false),
  ('join_communio', 'church', 6, 'Join the Network', 'Share anonymized signals with peer organizations.', 'join_communio', true),
  -- Workforce
  ('connect_email', 'workforce_development', 1, 'Connect Your Email', 'Bring employer conversations into CROS.', 'connect_email', false),
  ('import_contacts', 'workforce_development', 2, 'Import Your Contacts', 'Bring your employer partners in.', 'import_contacts', false),
  ('create_first_reflection', 'workforce_development', 3, 'Write Your First Reflection', 'A note about an employer relationship.', 'create_first_reflection', false),
  ('add_event', 'workforce_development', 4, 'Add a Hiring Event', 'Job fairs, site visits, or training sessions.', 'add_event', false),
  ('enable_signum', 'workforce_development', 5, 'Enable Local Signals', 'Discover workforce opportunities nearby.', 'enable_signum', false),
  -- Housing
  ('connect_email', 'housing', 1, 'Connect Your Email', 'Track housing partner communications.', 'connect_email', false),
  ('create_first_reflection', 'housing', 2, 'Write Your First Reflection', 'A note about a housing partner or resident.', 'create_first_reflection', false),
  ('add_event', 'housing', 3, 'Add a Community Event', 'Housing fairs, intake days, or partner meetings.', 'add_event', false),
  ('enable_signum', 'housing', 4, 'Enable Local Signals', 'Discover housing-related news and events.', 'enable_signum', false),
  -- Education
  ('connect_email', 'education', 1, 'Connect Your Email', 'Bring school and partner emails into CROS.', 'connect_email', false),
  ('create_first_reflection', 'education', 2, 'Write Your First Reflection', 'A note about a school or community partner.', 'create_first_reflection', false),
  ('add_event', 'education', 3, 'Add a Program Event', 'Tutoring sessions, workshops, or open houses.', 'add_event', false),
  ('enable_signum', 'education', 4, 'Enable Local Signals', 'Discover education news in your community.', 'enable_signum', false),
  -- Government
  ('connect_email', 'government', 1, 'Connect Your Email', 'Track constituent and agency communications.', 'connect_email', false),
  ('create_first_reflection', 'government', 2, 'Write Your First Reflection', 'A note about a community relationship.', 'create_first_reflection', false),
  ('add_event', 'government', 3, 'Add a Civic Event', 'Town halls, service events, or public meetings.', 'add_event', false),
  ('enable_signum', 'government', 4, 'Enable Local Signals', 'Discover civic news and community events.', 'enable_signum', false),
  -- Social Enterprise
  ('connect_email', 'social_enterprise', 1, 'Connect Your Email', 'Bring client and partner conversations in.', 'connect_email', false),
  ('import_contacts', 'social_enterprise', 2, 'Import Your Contacts', 'Bring your partners and clients in.', 'import_contacts', true),
  ('create_first_reflection', 'social_enterprise', 3, 'Write Your First Reflection', 'A note about a partner or community connection.', 'create_first_reflection', false),
  ('add_event', 'social_enterprise', 4, 'Add an Event', 'Pop-ups, partner meetings, or community events.', 'add_event', false),
  ('enable_signum', 'social_enterprise', 5, 'Enable Local Signals', 'Discover local enterprise and impact news.', 'enable_signum', false),
  -- Nonprofit Program (generic)
  ('connect_email', 'nonprofit_program', 1, 'Connect Your Email', 'Bring partner conversations into CROS.', 'connect_email', false),
  ('create_first_reflection', 'nonprofit_program', 2, 'Write Your First Reflection', 'A note about a community partner.', 'create_first_reflection', false),
  ('add_event', 'nonprofit_program', 3, 'Add a Program Event', 'Workshops, partner meetings, or community events.', 'add_event', false),
  ('enable_signum', 'nonprofit_program', 4, 'Enable Local Signals', 'Discover local news and opportunities.', 'enable_signum', false),
  -- Community Foundation
  ('connect_email', 'community_foundation', 1, 'Connect Your Email', 'Bring partner conversations into CROS.', 'connect_email', false),
  ('create_first_reflection', 'community_foundation', 2, 'Write Your First Reflection', 'A note about a community partner.', 'create_first_reflection', false),
  ('add_event', 'community_foundation', 3, 'Add a Community Event', 'Galas, partner meetings, or neighborhood events.', 'add_event', false),
  ('enable_signum', 'community_foundation', 4, 'Enable Local Signals', 'Discover philanthropic and community news.', 'enable_signum', false),
  ('join_communio', 'community_foundation', 5, 'Join the Network', 'Share signals with peer foundations.', 'join_communio', true),
  -- Public Library / City Program
  ('connect_email', 'public_library_or_city_program', 1, 'Connect Your Email', 'Track program and partner communications.', 'connect_email', false),
  ('create_first_reflection', 'public_library_or_city_program', 2, 'Write Your First Reflection', 'A note about a community program or partner.', 'create_first_reflection', false),
  ('add_event', 'public_library_or_city_program', 3, 'Add a Program Event', 'Classes, workshops, or community events.', 'add_event', false),
  ('enable_signum', 'public_library_or_city_program', 4, 'Enable Local Signals', 'Discover library and civic news.', 'enable_signum', false);

-- 3. onboarding_progress
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','skipped')),
  completed_at timestamptz NULL,
  UNIQUE(tenant_id, step_key)
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read own onboarding progress"
  ON public.onboarding_progress FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = onboarding_progress.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Tenant users can update own onboarding progress"
  ON public.onboarding_progress FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = onboarding_progress.tenant_id AND tu.user_id = auth.uid())
  );

CREATE POLICY "Insert onboarding progress"
  ON public.onboarding_progress FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = onboarding_progress.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4. nri_support_sessions
CREATE TABLE IF NOT EXISTS public.nri_support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.nri_support_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own support sessions"
  ON public.nri_support_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own support sessions"
  ON public.nri_support_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
