
-- Operator-level contacts (gardener sales prospects, not tenant contacts)
CREATE TABLE public.operator_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  organization TEXT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operator_contacts ENABLE ROW LEVEL SECURITY;

-- Only admins (operators/gardeners) can access
CREATE POLICY "Admins can view all operator contacts"
  ON public.operator_contacts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert operator contacts"
  ON public.operator_contacts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update operator contacts"
  ON public.operator_contacts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete operator contacts"
  ON public.operator_contacts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for common lookups
CREATE INDEX idx_operator_contacts_opportunity ON public.operator_contacts(opportunity_id);
CREATE INDEX idx_operator_contacts_email ON public.operator_contacts(email);

-- Timestamp trigger
CREATE TRIGGER update_operator_contacts_updated_at
  BEFORE UPDATE ON public.operator_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
