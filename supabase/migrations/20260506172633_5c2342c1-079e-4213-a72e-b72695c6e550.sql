
-- Per-tenant Google Form (or other webhook) intakes
CREATE TABLE public.tenant_form_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  source text NOT NULL DEFAULT 'google_form',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  archived_at timestamptz,
  last_seen_at timestamptz,
  submission_count integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_form_intakes_tenant ON public.tenant_form_intakes(tenant_id) WHERE archived_at IS NULL;

ALTER TABLE public.tenant_form_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view form intakes"
  ON public.tenant_form_intakes FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can manage form intakes"
  ON public.tenant_form_intakes FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

-- Each Form submission lands here as a pending lead until reviewed
CREATE TABLE public.form_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  intake_id uuid NOT NULL REFERENCES public.tenant_form_intakes(id) ON DELETE CASCADE,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_name text,
  parsed_email text,
  parsed_phone text,
  parsed_notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'promoted', 'dismissed')),
  promoted_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_intake_submissions_tenant_status
  ON public.form_intake_submissions(tenant_id, status, created_at DESC);

ALTER TABLE public.form_intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view submissions"
  ON public.form_intake_submissions FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update submissions"
  ON public.form_intake_submissions FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can delete submissions"
  ON public.form_intake_submissions FOR DELETE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- Inserts come from the edge function via service role; no INSERT policy for users.

CREATE TRIGGER update_tenant_form_intakes_updated_at
  BEFORE UPDATE ON public.tenant_form_intakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
