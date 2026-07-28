
-- Household / Family members table
CREATE TABLE public.contact_household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 120),
  relationship text NULL CHECK (relationship IS NULL OR char_length(relationship) <= 60),
  notes text NULL CHECK (notes IS NULL OR char_length(notes) <= 300),
  linked_contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_household_tenant_contact ON public.contact_household_members (tenant_id, contact_id);
CREATE INDEX idx_household_tenant_linked ON public.contact_household_members (tenant_id, linked_contact_id);

ALTER TABLE public.contact_household_members ENABLE ROW LEVEL SECURITY;

-- RLS: tenant-scoped, mirrors contacts access pattern
CREATE POLICY "Tenant users can view household members"
  ON public.contact_household_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = contact_household_members.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can insert household members"
  ON public.contact_household_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = contact_household_members.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can update household members"
  ON public.contact_household_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = contact_household_members.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can delete household members"
  ON public.contact_household_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = contact_household_members.tenant_id
        AND tu.user_id = auth.uid()
    )
  );
