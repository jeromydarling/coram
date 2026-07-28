
-- ═══════════════════════════════════════════════════════════
-- Email Suppressions (Do Not Email list)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribed',
  source text NOT NULL DEFAULT 'self_service',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT email_suppressions_reason_check CHECK (reason IN ('unsubscribed','complaint','bounce','manual')),
  CONSTRAINT email_suppressions_source_check CHECK (source IN ('self_service','admin','system'))
);

CREATE UNIQUE INDEX idx_email_suppressions_tenant_email ON public.email_suppressions (tenant_id, lower(email));
CREATE INDEX idx_email_suppressions_tenant_created ON public.email_suppressions (tenant_id, created_at DESC);
CREATE INDEX idx_email_suppressions_email ON public.email_suppressions (lower(email));

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins full access to suppressions"
  ON public.email_suppressions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Tenant staff can view suppressions for their tenant
CREATE POLICY "Tenant staff can view suppressions"
  ON public.email_suppressions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.tenant_id = email_suppressions.tenant_id
    )
  );

-- ═══════════════════════════════════════════════════════════
-- Unsubscribe Tokens
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  campaign_id uuid NULL REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_unsub_tokens_tenant_email ON public.email_unsubscribe_tokens (tenant_id, lower(email));
CREATE INDEX idx_unsub_tokens_created ON public.email_unsubscribe_tokens (created_at DESC);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- Do Not Email View
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.email_do_not_email AS
SELECT tenant_id, lower(email) as email, max(created_at) as suppressed_at
FROM public.email_suppressions
GROUP BY tenant_id, lower(email);
