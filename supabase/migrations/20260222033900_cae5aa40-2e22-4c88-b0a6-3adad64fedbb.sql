
-- Communio Requests: tenants ask for help from their network
CREATE TABLE public.communio_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_communio_requests_tenant ON public.communio_requests (tenant_id);
CREATE INDEX idx_communio_requests_created ON public.communio_requests (created_at DESC);

ALTER TABLE public.communio_requests ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read requests (community visibility)
CREATE POLICY "authenticated_read_communio_requests" ON public.communio_requests
  FOR SELECT TO authenticated USING (true);

-- Tenants can insert their own requests
CREATE POLICY "tenant_insert_communio_requests" ON public.communio_requests
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Communio Replies
CREATE TABLE public.communio_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.communio_requests(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_communio_replies_request ON public.communio_replies (request_id);

ALTER TABLE public.communio_replies ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read replies
CREATE POLICY "authenticated_read_communio_replies" ON public.communio_replies
  FOR SELECT TO authenticated USING (true);

-- Tenants can insert replies
CREATE POLICY "tenant_insert_communio_replies" ON public.communio_replies
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
