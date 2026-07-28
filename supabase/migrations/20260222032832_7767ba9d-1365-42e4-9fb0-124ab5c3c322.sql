
-- Create registration field type enum
CREATE TYPE public.registration_field_type AS ENUM ('text', 'select', 'checkbox', 'note');

-- Event registration custom fields (max 8 per event enforced in app)
CREATE TABLE public.event_registration_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type public.registration_field_type NOT NULL DEFAULT 'text',
  options jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event registrations (public RSVP)
CREATE TABLE public.event_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id),
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  answers jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_event_registration_fields_event ON public.event_registration_fields(event_id);
CREATE INDEX idx_event_registrations_event ON public.event_registrations(event_id);
CREATE INDEX idx_event_registrations_email ON public.event_registrations(guest_email);

-- RLS: registration_fields readable by anyone (public form), manageable by tenant users
ALTER TABLE public.event_registration_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read registration fields"
  ON public.event_registration_fields FOR SELECT
  USING (true);

CREATE POLICY "Tenant users can manage registration fields"
  ON public.event_registration_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = event_registration_fields.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- RLS: registrations insertable by anyone (public), readable by tenant users
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register for events"
  ON public.event_registrations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Tenant users can view registrations"
  ON public.event_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = event_registrations.tenant_id
        AND tu.user_id = auth.uid()
    )
  );
