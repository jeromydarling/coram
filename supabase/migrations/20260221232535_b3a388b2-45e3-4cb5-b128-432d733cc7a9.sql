
-- Tenant-scoped UI lens preferences (visitor mode toggle)
CREATE TABLE public.tenant_user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ui_lens text NOT NULL DEFAULT 'default' CHECK (ui_lens IN ('default', 'visitor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- Indexes
CREATE INDEX idx_tenant_user_prefs_tenant ON public.tenant_user_preferences(tenant_id);
CREATE INDEX idx_tenant_user_prefs_user ON public.tenant_user_preferences(user_id);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_tenant_user_preferences
  BEFORE UPDATE ON public.tenant_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.tenant_user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own preferences"
  ON public.tenant_user_preferences FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON public.tenant_user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON public.tenant_user_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
