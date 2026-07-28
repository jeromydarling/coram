
-- Generosity records table
CREATE TABLE public.generosity_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  gift_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_frequency text CHECK (recurring_frequency IN ('monthly', 'annual')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_generosity_records_contact ON public.generosity_records(contact_id);
CREATE INDEX idx_generosity_records_tenant ON public.generosity_records(tenant_id);
CREATE INDEX idx_generosity_records_date ON public.generosity_records(gift_date);

ALTER TABLE public.generosity_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view generosity records"
  ON public.generosity_records FOR SELECT
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can insert generosity records"
  ON public.generosity_records FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update generosity records"
  ON public.generosity_records FOR UPDATE
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can delete generosity records"
  ON public.generosity_records FOR DELETE
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE TRIGGER update_generosity_records_updated_at
  BEFORE UPDATE ON public.generosity_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
