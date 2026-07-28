
-- 1) Add person_type and is_person_in_need to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS person_type text NOT NULL DEFAULT 'partner_contact',
  ADD COLUMN IF NOT EXISTS is_person_in_need boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_person_type_check CHECK (person_type IN ('partner_contact','community_member'));

-- 2) Add subject_contact_id to activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS subject_contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_subject_contact ON public.activities(subject_contact_id, activity_date_time DESC);

-- 3) Create activity_participants table
CREATE TABLE IF NOT EXISTS public.activity_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  volunteer_id uuid NULL REFERENCES public.volunteers(id) ON DELETE SET NULL,
  contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (char_length(display_name) <= 120),
  role text NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer','staff','visitor','other')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_participants_tenant_activity ON public.activity_participants(tenant_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_tenant_volunteer ON public.activity_participants(tenant_id, volunteer_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_tenant_contact ON public.activity_participants(tenant_id, contact_id);

-- 4) RLS for activity_participants
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view participants"
  ON public.activity_participants FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can insert participants"
  ON public.activity_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can update participants"
  ON public.activity_participants FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can delete participants"
  ON public.activity_participants FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );
