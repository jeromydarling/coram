
-- Phase 7Ω.1: Impersonation audit + safety gates

-- 1) impersonation_sessions
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  is_demo boolean NOT NULL DEFAULT true,
  reason text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  last_seen_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','revoked')),
  ip_hash text NULL,
  user_agent text NULL
);

CREATE INDEX idx_impersonation_sessions_admin ON public.impersonation_sessions (admin_user_id, started_at DESC);
CREATE INDEX idx_impersonation_sessions_tenant ON public.impersonation_sessions (tenant_id, started_at DESC);
CREATE INDEX idx_impersonation_sessions_target ON public.impersonation_sessions (target_user_id, started_at DESC);
CREATE INDEX idx_impersonation_sessions_active ON public.impersonation_sessions (status) WHERE status = 'active';

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only: select impersonation_sessions"
  ON public.impersonation_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin only: insert impersonation_sessions"
  ON public.impersonation_sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin only: update impersonation_sessions"
  ON public.impersonation_sessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin only: delete impersonation_sessions"
  ON public.impersonation_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) operator_security_settings
CREATE TABLE public.operator_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allow_production_impersonation boolean NOT NULL DEFAULT false,
  allow_demo_impersonation boolean NOT NULL DEFAULT true,
  max_impersonation_minutes int NOT NULL DEFAULT 60,
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only: select operator_security_settings"
  ON public.operator_security_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin only: update operator_security_settings"
  ON public.operator_security_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default settings row
INSERT INTO public.operator_security_settings (allow_production_impersonation, allow_demo_impersonation, max_impersonation_minutes)
VALUES (false, true, 60);
