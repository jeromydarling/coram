
-- operator_app_errors: centralized error tracking for operator desk
CREATE TABLE public.operator_app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('frontend','edge_function','database','integration')),
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high')),
  fingerprint text NOT NULL,
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}',
  repro_steps text NULL,
  expected text NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','ignored')),
  owner_notes text NULL,
  lovable_prompt text NULL
);

-- Composite index for fast filtering
CREATE INDEX idx_operator_app_errors_tenant_status ON public.operator_app_errors (tenant_id, status, last_seen_at DESC);

-- Unique constraint for upsert deduplication
CREATE UNIQUE INDEX idx_operator_app_errors_fingerprint ON public.operator_app_errors (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), fingerprint);

-- RLS: admin only
ALTER TABLE public.operator_app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_operator_app_errors" ON public.operator_app_errors
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_operator_app_errors" ON public.operator_app_errors
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_operator_app_errors" ON public.operator_app_errors
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_operator_app_errors" ON public.operator_app_errors
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RPC for upsert from edge functions (service role or admin)
CREATE OR REPLACE FUNCTION public.upsert_operator_error(
  p_tenant_id uuid,
  p_source text,
  p_severity text,
  p_fingerprint text,
  p_message text,
  p_context jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_coalesced_tenant uuid;
BEGIN
  v_coalesced_tenant := COALESCE(p_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  INSERT INTO operator_app_errors (tenant_id, source, severity, fingerprint, message, context)
  VALUES (p_tenant_id, p_source, p_severity, p_fingerprint, p_message, p_context)
  ON CONFLICT (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), fingerprint)
  DO UPDATE SET
    count = operator_app_errors.count + 1,
    last_seen_at = now(),
    severity = CASE 
      WHEN p_severity = 'high' THEN 'high'
      WHEN operator_app_errors.severity = 'high' THEN 'high'
      ELSE p_severity
    END,
    context = p_context
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;
