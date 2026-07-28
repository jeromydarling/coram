
-- Communio Public Profiles table
CREATE TABLE public.communio_public_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  archetype TEXT,
  metros JSONB DEFAULT '[]'::jsonb,
  presence_story TEXT,
  website_url TEXT,
  contact_email TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'network', 'public')),
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT communio_public_profiles_tenant_unique UNIQUE (tenant_id)
);

-- Index for public directory lookups
CREATE INDEX idx_communio_public_profiles_visibility ON public.communio_public_profiles(visibility);

-- RLS
ALTER TABLE public.communio_public_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public/network profiles
CREATE POLICY "Anyone can read public profiles"
  ON public.communio_public_profiles
  FOR SELECT
  USING (visibility IN ('public', 'network'));

-- Authenticated users can read their own profile (even if private)
CREATE POLICY "Tenant members can read own profile"
  ON public.communio_public_profiles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Tenant members can insert their own profile
CREATE POLICY "Tenant members can insert own profile"
  ON public.communio_public_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Tenant members can update their own profile
CREATE POLICY "Tenant members can update own profile"
  ON public.communio_public_profiles
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER communio_public_profiles_updated_at
  BEFORE UPDATE ON public.communio_public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
