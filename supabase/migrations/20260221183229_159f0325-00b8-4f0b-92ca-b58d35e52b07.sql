
-- Phase 8U+8V: Operator Awareness + Calm Mode tables (retry without generated column)

CREATE TABLE public.operator_awareness_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('activation', 'migration', 'expansion', 'narrative', 'friction', 'growth')),
  title text NOT NULL,
  summary text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  metro_id uuid REFERENCES public.metros(id) ON DELETE SET NULL,
  signal_strength int NOT NULL DEFAULT 1,
  source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  resolved boolean NOT NULL DEFAULT false,
  dedupe_key text
);

CREATE INDEX idx_awareness_category ON public.operator_awareness_events(category);
CREATE INDEX idx_awareness_resolved ON public.operator_awareness_events(resolved) WHERE NOT resolved;
CREATE INDEX idx_awareness_tenant ON public.operator_awareness_events(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_awareness_created ON public.operator_awareness_events(created_at DESC);
CREATE UNIQUE INDEX idx_awareness_dedupe ON public.operator_awareness_events(dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.operator_awareness_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read awareness events"
  ON public.operator_awareness_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service insert awareness events"
  ON public.operator_awareness_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update awareness events"
  ON public.operator_awareness_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- operator_preferences
CREATE TABLE public.operator_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calm_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own preferences"
  ON public.operator_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users upsert own preferences"
  ON public.operator_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own preferences"
  ON public.operator_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- operator_focus_tenant
CREATE TABLE public.operator_focus_tenant (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_focus_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own focus tenant"
  ON public.operator_focus_tenant FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users upsert own focus tenant"
  ON public.operator_focus_tenant FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own focus tenant"
  ON public.operator_focus_tenant FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own focus tenant"
  ON public.operator_focus_tenant FOR DELETE TO authenticated
  USING (user_id = auth.uid());
