
-- tenant_public_profiles: Identity + Communio presence for tenants
CREATE TABLE public.tenant_public_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name text,
  tagline text,
  mission_summary text,
  logo_url text,
  website_url text,
  source_url text,
  city text,
  state text,
  metro_hint text,
  programs jsonb DEFAULT '[]'::jsonb,
  populations_served jsonb DEFAULT '[]'::jsonb,
  keywords jsonb DEFAULT '[]'::jsonb,
  archetype_suggested text,
  archetype_selected text,
  communio_opt_in boolean NOT NULL DEFAULT false,
  visibility_level text NOT NULL DEFAULT 'private'
    CHECK (visibility_level IN ('private', 'communio', 'public')),
  enrichment_source text,
  enrichment_coverage text,
  enriched_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_public_profiles_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX idx_tenant_public_profiles_communio ON public.tenant_public_profiles (communio_opt_in) WHERE communio_opt_in = true;
CREATE INDEX idx_tenant_public_profiles_visibility ON public.tenant_public_profiles (visibility_level) WHERE visibility_level != 'private';

ALTER TABLE public.tenant_public_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_users_read_own_profile" ON public.tenant_public_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = tenant_public_profiles.tenant_id AND tu.user_id = auth.uid())
  );

CREATE POLICY "tenant_users_update_own_profile" ON public.tenant_public_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = tenant_public_profiles.tenant_id AND tu.user_id = auth.uid() AND tu.role IN ('admin', 'steward'))
  );

CREATE POLICY "communio_profiles_readable" ON public.tenant_public_profiles
  FOR SELECT USING (visibility_level IN ('communio', 'public') AND status = 'published' AND auth.role() = 'authenticated');

CREATE POLICY "public_profiles_anon_readable" ON public.tenant_public_profiles
  FOR SELECT USING (visibility_level = 'public' AND status = 'published');

CREATE POLICY "service_role_insert_profiles" ON public.tenant_public_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admins_read_all_profiles" ON public.tenant_public_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );
