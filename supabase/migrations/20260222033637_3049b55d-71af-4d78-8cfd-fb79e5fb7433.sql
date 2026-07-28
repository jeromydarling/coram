
-- system_error_events: captures runtime errors for auto-healing prompt generation
CREATE TABLE public.system_error_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  route text NOT NULL DEFAULT '',
  component text NOT NULL DEFAULT '',
  error_type text NOT NULL DEFAULT 'unknown',
  stack_excerpt text,
  user_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_error_events_created ON public.system_error_events (created_at DESC);
CREATE INDEX idx_system_error_events_type ON public.system_error_events (error_type);

ALTER TABLE public.system_error_events ENABLE ROW LEVEL SECURITY;

-- Admins can read
CREATE POLICY "admin_read_system_error_events" ON public.system_error_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert (error capture)
CREATE POLICY "authenticated_insert_system_error_events" ON public.system_error_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow anon insert for edge function errors (service role writes)
CREATE POLICY "anon_insert_system_error_events" ON public.system_error_events
  FOR INSERT WITH CHECK (true);
