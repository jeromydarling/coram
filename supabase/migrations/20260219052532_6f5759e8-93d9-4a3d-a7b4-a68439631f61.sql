
-- ============================================================
-- PART 1A: CORE TENANCY TABLES
-- ============================================================

-- 1. tenants
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  tier text NOT NULL DEFAULT 'core',
  archetype text NULL,
  settings jsonb NOT NULL DEFAULT '{}'
);

-- Use validation trigger instead of CHECK (per guidelines)
CREATE OR REPLACE FUNCTION public.validate_tenant_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'paused', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid tenant status: %', NEW.status;
  END IF;
  IF NEW.tier NOT IN ('core', 'insight', 'story', 'bridge') THEN
    RAISE EXCEPTION 'Invalid tenant tier: %', NEW.tier;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tenant
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_status();

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. tenant_users
CREATE TABLE public.tenant_users (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  home_metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE OR REPLACE FUNCTION public.validate_tenant_user_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role NOT IN ('admin', 'regional_lead', 'staff', 'leadership', 'warehouse_manager') THEN
    RAISE EXCEPTION 'Invalid tenant_users role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tenant_user_role
  BEFORE INSERT OR UPDATE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_user_role();

-- 3. tenant_domains (future custom domains)
CREATE TABLE public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain text UNIQUE NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 1B: TENANCY HELPER FUNCTIONS
-- ============================================================

-- Check if current user belongs to a given tenant
CREATE OR REPLACE FUNCTION public.user_in_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  )
$$;

-- Check if current user has a specific role within a tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;

-- Check if current user has any of the given roles within a tenant
CREATE OR REPLACE FUNCTION public.has_any_tenant_role(_tenant_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role = ANY(_roles)
  )
$$;

-- Get all tenant IDs for the current user
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
$$;

-- Check if current user is admin in ANY of their tenants
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role = 'admin'
  )
$$;

-- ============================================================
-- PART 1C: RLS POLICIES ON TENANCY TABLES
-- ============================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- tenants: users can see tenants they belong to
CREATE POLICY "Users can view own tenants"
  ON public.tenants FOR SELECT
  USING (public.user_in_tenant(id));

-- tenants: only tenant admins can update
CREATE POLICY "Tenant admins can update tenant"
  ON public.tenants FOR UPDATE
  USING (public.is_tenant_admin(id));

-- tenant_users: members can see other members of their tenant
CREATE POLICY "Members can view tenant users"
  ON public.tenant_users FOR SELECT
  USING (public.user_in_tenant(tenant_id));

-- tenant_users: tenant admins can insert new members
CREATE POLICY "Tenant admins can add users"
  ON public.tenant_users FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- tenant_users: tenant admins can update member roles
CREATE POLICY "Tenant admins can update users"
  ON public.tenant_users FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

-- tenant_users: tenant admins can remove members
CREATE POLICY "Tenant admins can remove users"
  ON public.tenant_users FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

-- tenant_domains: visible to tenant members
CREATE POLICY "Members can view tenant domains"
  ON public.tenant_domains FOR SELECT
  USING (public.user_in_tenant(tenant_id));

-- tenant_domains: only tenant admins can manage
CREATE POLICY "Tenant admins can manage domains"
  ON public.tenant_domains FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update domains"
  ON public.tenant_domains FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete domains"
  ON public.tenant_domains FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

-- ============================================================
-- PART 1D: ADD tenant_id TO EXISTING TABLES (NULLABLE FIRST)
-- Safe, non-breaking additions for future tenant scoping
-- ============================================================

-- Use join tables for deeply-entrenched global tables
CREATE TABLE public.tenant_metros (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, metro_id)
);

ALTER TABLE public.tenant_metros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant metros"
  ON public.tenant_metros FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage metros"
  ON public.tenant_metros FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can remove metros"
  ON public.tenant_metros FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

-- Add nullable tenant_id to key operational tables
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.discovered_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.discovery_runs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.discovery_briefings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.email_communications ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.opportunity_orders ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.volunteer_shifts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Add external_ids for import idempotency (Part 5 prep)
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}';

-- Indexes for tenant_id lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant ON public.opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON public.activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON public.events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant ON public.email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_orders_tenant ON public.opportunity_orders(tenant_id);
