
-- =============================================
-- FAMILIA ONTOLOGY — Phase 21F
-- Organizational kinship + NRI detection
-- =============================================

-- 1) familias table
CREATE TABLE public.familias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;

-- 2) familia_memberships table
CREATE TABLE public.familia_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id UUID NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(familia_id, tenant_id)
);

ALTER TABLE public.familia_memberships ENABLE ROW LEVEL SECURITY;

-- Validation trigger for membership role/status
CREATE OR REPLACE FUNCTION public.validate_familia_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.role NOT IN ('founder', 'member') THEN
    RAISE EXCEPTION 'Invalid familia_memberships role: %', NEW.role;
  END IF;
  IF NEW.status NOT IN ('pending', 'active') THEN
    RAISE EXCEPTION 'Invalid familia_memberships status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_familia_membership
BEFORE INSERT OR UPDATE ON public.familia_memberships
FOR EACH ROW EXECUTE FUNCTION public.validate_familia_membership();

-- 3) familia_suggestions table (NRI kinship detection output)
CREATE TABLE public.familia_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  candidate_tenant_id UUID REFERENCES public.tenants(id),
  candidate_hint TEXT NOT NULL DEFAULT 'A nearby organization with shared mission signals',
  kinship_score NUMERIC NOT NULL DEFAULT 0,
  reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.familia_suggestions ENABLE ROW LEVEL SECURITY;

-- Validation trigger for suggestion status
CREATE OR REPLACE FUNCTION public.validate_familia_suggestion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'snoozed', 'dismissed', 'linked') THEN
    RAISE EXCEPTION 'Invalid familia_suggestions status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_familia_suggestion
BEFORE INSERT OR UPDATE ON public.familia_suggestions
FOR EACH ROW EXECUTE FUNCTION public.validate_familia_suggestion();

-- 4) Add nullable familia_id to tenants
ALTER TABLE public.tenants ADD COLUMN familia_id UUID REFERENCES public.familias(id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Helper: check if user's tenant is a member of a familia
CREATE OR REPLACE FUNCTION public.is_familia_member(_user_id UUID, _familia_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.familia_memberships fm
    JOIN public.tenant_users tu ON tu.tenant_id = fm.tenant_id
    WHERE tu.user_id = _user_id
      AND fm.familia_id = _familia_id
      AND fm.status = 'active'
  );
$$;

-- familias: visible to creator tenant and active members
CREATE POLICY "Familia visible to members"
ON public.familias FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND (tu.tenant_id = created_by_tenant_id
           OR public.is_familia_member(auth.uid(), id))
  )
);

CREATE POLICY "Familia created by tenant steward"
ON public.familias FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = created_by_tenant_id
  )
);

-- familia_memberships: visible to own tenant or active familia members
CREATE POLICY "Membership visible to own tenant or familia members"
ON public.familia_memberships FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = familia_memberships.tenant_id
  )
  OR public.is_familia_member(auth.uid(), familia_id)
);

CREATE POLICY "Membership insert by own tenant"
ON public.familia_memberships FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = familia_memberships.tenant_id
  )
);

CREATE POLICY "Membership update by own tenant"
ON public.familia_memberships FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = familia_memberships.tenant_id
  )
);

-- familia_suggestions: visible only to the receiving tenant
CREATE POLICY "Suggestions visible to receiving tenant"
ON public.familia_suggestions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = familia_suggestions.tenant_id
  )
);

CREATE POLICY "Suggestions updatable by receiving tenant"
ON public.familia_suggestions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = familia_suggestions.tenant_id
  )
);

-- Operator (admin) can insert suggestions via edge functions
CREATE POLICY "Suggestions insertable by admin"
ON public.familia_suggestions FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- Indexes
CREATE INDEX idx_familia_memberships_tenant ON public.familia_memberships(tenant_id);
CREATE INDEX idx_familia_memberships_familia ON public.familia_memberships(familia_id);
CREATE INDEX idx_familia_suggestions_tenant ON public.familia_suggestions(tenant_id);
CREATE INDEX idx_familia_suggestions_status ON public.familia_suggestions(status);
CREATE INDEX idx_tenants_familia ON public.tenants(familia_id);
