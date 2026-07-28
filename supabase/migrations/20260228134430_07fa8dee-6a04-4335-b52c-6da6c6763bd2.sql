
-- Operator-level opportunities (gardener's own sales pipeline)
-- Completely separate from tenant opportunities
CREATE TABLE public.operator_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization TEXT NOT NULL,
  website TEXT,
  notes TEXT,
  stage TEXT NOT NULL DEFAULT 'Researching',
  status TEXT NOT NULL DEFAULT 'active',
  metro TEXT,
  primary_contact_id UUID REFERENCES public.operator_contacts(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link operator contacts to operator opportunities (many-to-many)
CREATE TABLE public.operator_opportunity_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.operator_opportunities(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.operator_contacts(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'contact',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, contact_id)
);

-- Operator journey notes / reflections on their prospects
CREATE TABLE public.operator_journey_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.operator_opportunities(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add opportunity_id to operator_contacts for quick primary link
ALTER TABLE public.operator_contacts
  ADD CONSTRAINT operator_contacts_opportunity_fk
  FOREIGN KEY (opportunity_id) REFERENCES public.operator_opportunities(id) ON DELETE SET NULL;

-- Enable RLS on all new tables
ALTER TABLE public.operator_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_opportunity_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_journey_notes ENABLE ROW LEVEL SECURITY;

-- RLS: operator_opportunities — admin only
CREATE POLICY "Admins can select operator opportunities"
  ON public.operator_opportunities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert operator opportunities"
  ON public.operator_opportunities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update operator opportunities"
  ON public.operator_opportunities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete operator opportunities"
  ON public.operator_opportunities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: operator_opportunity_contacts — admin only
CREATE POLICY "Admins can select operator opp contacts"
  ON public.operator_opportunity_contacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert operator opp contacts"
  ON public.operator_opportunity_contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete operator opp contacts"
  ON public.operator_opportunity_contacts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: operator_journey_notes — admin only
CREATE POLICY "Admins can select operator journey notes"
  ON public.operator_journey_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert operator journey notes"
  ON public.operator_journey_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_operator_opportunities_stage ON public.operator_opportunities(stage);
CREATE INDEX idx_operator_opp_contacts_opp ON public.operator_opportunity_contacts(opportunity_id);
CREATE INDEX idx_operator_opp_contacts_contact ON public.operator_opportunity_contacts(contact_id);
CREATE INDEX idx_operator_journey_notes_opp ON public.operator_journey_notes(opportunity_id);

-- Timestamp triggers
CREATE TRIGGER update_operator_opportunities_updated_at
  BEFORE UPDATE ON public.operator_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
