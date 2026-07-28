
-- Compass user state for cross-device sync of dismissals & cooldown
CREATE TABLE public.compass_user_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  dismissed_nudge_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismissed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_auto_open_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

ALTER TABLE public.compass_user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own compass state"
  ON public.compass_user_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
