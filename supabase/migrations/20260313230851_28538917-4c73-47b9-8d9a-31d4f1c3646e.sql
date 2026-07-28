
-- ============================================================
-- CROS Payments Infrastructure — Stripe Connect + Financial Layer
-- ============================================================

-- 1. Financial event types enum
CREATE TYPE public.financial_event_type AS ENUM (
  'generosity', 'participation', 'collaboration', 'support', 'invoice', 'membership'
);

-- 2. Financial event status enum
CREATE TYPE public.financial_event_status AS ENUM (
  'pending', 'completed', 'failed', 'cancelled', 'refunded'
);

-- 3. Tenant Stripe Connect accounts
CREATE TABLE public.tenant_stripe_connect (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_stripe_connect ENABLE ROW LEVEL SECURITY;

-- Tenant members can view, only admins can manage (enforced in edge functions)
CREATE POLICY "Tenant members can view connect status"
  ON public.tenant_stripe_connect
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- 4. Payment links created by tenants
CREATE TABLE public.tenant_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  event_type public.financial_event_type NOT NULL DEFAULT 'support',
  stripe_payment_link_id TEXT,
  stripe_payment_link_url TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_id UUID,
  max_quantity INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view payment links"
  ON public.tenant_payment_links
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can create payment links"
  ON public.tenant_payment_links
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update payment links"
  ON public.tenant_payment_links
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- 5. Tenant invoices
CREATE TABLE public.tenant_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  due_date DATE,
  note TEXT,
  stripe_invoice_id TEXT,
  stripe_hosted_url TEXT,
  status public.financial_event_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view invoices"
  ON public.tenant_invoices
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can create invoices"
  ON public.tenant_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update invoices"
  ON public.tenant_invoices
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- 6. Unified financial events (timeline-first)
CREATE TABLE public.financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_type public.financial_event_type NOT NULL,
  status public.financial_event_status NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  title TEXT NOT NULL,
  description TEXT,
  note TEXT,
  payer_name TEXT,
  payer_email TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  payment_link_id UUID REFERENCES public.tenant_payment_links(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.tenant_invoices(id) ON DELETE SET NULL,
  event_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view financial events"
  ON public.financial_events
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can create financial events"
  ON public.financial_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

-- 7. Event payment settings (extends existing events table)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_cents INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES public.tenant_payment_links(id) ON DELETE SET NULL;

-- 8. Stripe Connect webhook events (idempotency)
CREATE TABLE public.stripe_connect_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_connect_webhook_events ENABLE ROW LEVEL SECURITY;
-- No public access — service role only via edge functions

-- Index for financial events queries
CREATE INDEX idx_financial_events_tenant_type ON public.financial_events(tenant_id, event_type);
CREATE INDEX idx_financial_events_contact ON public.financial_events(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_financial_events_status ON public.financial_events(tenant_id, status);
CREATE INDEX idx_tenant_invoices_tenant ON public.tenant_invoices(tenant_id);
CREATE INDEX idx_tenant_payment_links_tenant ON public.tenant_payment_links(tenant_id);
