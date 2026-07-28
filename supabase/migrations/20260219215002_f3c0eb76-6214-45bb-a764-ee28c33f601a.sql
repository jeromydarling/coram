
-- ============================================
-- operator_intake: Global intake for user help requests
-- Routed to Operator Console, not tenant admin
-- ============================================

CREATE TABLE public.operator_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  intake_type text NOT NULL CHECK (intake_type IN ('problem', 'request')),
  title text NOT NULL CHECK (char_length(title) <= 120),
  body text NOT NULL CHECK (char_length(body) <= 6000),
  module_key text NULL,
  page_path text NULL,
  client_meta jsonb NOT NULL DEFAULT '{}',
  attachments jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'in_progress', 'needs_more_info', 'resolved', 'closed')),
  operator_notes text NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_operator_intake_tenant_created ON public.operator_intake (tenant_id, created_at DESC);
CREATE INDEX idx_operator_intake_status_created ON public.operator_intake (status, created_at DESC);
CREATE INDEX idx_operator_intake_submitter ON public.operator_intake (submitted_by, created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_operator_intake_updated_at
  BEFORE UPDATE ON public.operator_intake
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.operator_intake ENABLE ROW LEVEL SECURITY;

-- SELECT: submitter sees own rows; admin sees all
CREATE POLICY "Users can view their own intake submissions"
  ON public.operator_intake FOR SELECT
  USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- INSERT: authenticated users can insert their own
CREATE POLICY "Authenticated users can submit intake"
  ON public.operator_intake FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

-- UPDATE: admin only (for status, notes, resolved_at)
CREATE POLICY "Admins can update intake"
  ON public.operator_intake FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- DELETE: admin only
CREATE POLICY "Admins can delete intake"
  ON public.operator_intake FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
