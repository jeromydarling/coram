
-- ═══════════════════════════════════════════════════════════════
-- Companion → Tenant Absorption — Schema Phase
-- ═══════════════════════════════════════════════════════════════

-- 1. Track relationship origin on opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS source_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_user_id UUID;

COMMENT ON COLUMN public.opportunities.origin_type IS 'How this relationship entered the tenant: tenant (created here), personal (companion-owned), moved (transferred from companion), copied (duplicated from companion)';
COMMENT ON COLUMN public.opportunities.source_opportunity_id IS 'For copied relationships, the original opportunity ID';
COMMENT ON COLUMN public.opportunities.source_user_id IS 'For moved/copied relationships, the original companion user ID';

-- 2. Track relationship origin on contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS source_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_user_id UUID;

COMMENT ON COLUMN public.contacts.origin_type IS 'How this person entered the tenant: tenant, personal, moved, copied';
COMMENT ON COLUMN public.contacts.source_contact_id IS 'For copied people, the original contact ID';
COMMENT ON COLUMN public.contacts.source_user_id IS 'For moved/copied people, the original companion user ID';

-- 3. Companion absorption requests — tracks the join decision
CREATE TABLE IF NOT EXISTS public.companion_absorption_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES public.tenant_invites(id) ON DELETE SET NULL,
  relationship_strategy TEXT NOT NULL DEFAULT 'private'
    CHECK (relationship_strategy IN ('private', 'move', 'copy')),
  selected_opportunity_ids UUID[] NOT NULL DEFAULT '{}',
  selected_contact_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companion_absorption_requests IS 'Tracks when a free Companion joins an organization and their relationship handling choice (private/move/copy)';

-- Index for lookup by user
CREATE INDEX IF NOT EXISTS idx_companion_absorption_user
  ON public.companion_absorption_requests(user_id);

-- Index for lookup by target tenant
CREATE INDEX IF NOT EXISTS idx_companion_absorption_target
  ON public.companion_absorption_requests(target_tenant_id);

-- 4. Add companion_origin flag to tenant_users for visibility
ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS joined_from_companion BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS absorption_request_id UUID REFERENCES public.companion_absorption_requests(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tenant_users.joined_from_companion IS 'True when user joined this tenant from a free Companion account';
COMMENT ON COLUMN public.tenant_users.absorption_request_id IS 'Links to the absorption request that created this membership';

-- 5. RLS for companion_absorption_requests
ALTER TABLE public.companion_absorption_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own absorption requests
CREATE POLICY "Users can view own absorption requests"
  ON public.companion_absorption_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own absorption requests
CREATE POLICY "Users can create own absorption requests"
  ON public.companion_absorption_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Tenant admins/stewards can view absorption requests for their tenant
CREATE POLICY "Tenant members can view absorption requests for their tenant"
  ON public.companion_absorption_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = companion_absorption_requests.target_tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('admin', 'steward')
    )
  );
