
CREATE TABLE public.gardener_ga_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  property_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gardener_ga_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners manage own GA connections"
  ON public.gardener_ga_connections FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'steward'::public.app_role])
  );
