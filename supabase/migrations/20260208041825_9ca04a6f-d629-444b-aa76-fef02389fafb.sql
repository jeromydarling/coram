
-- campaign_suggestions: deterministic outreach suggestions from watchlist signals
CREATE TABLE public.campaign_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'watchlist_signal',
  source_id uuid NOT NULL,
  suggestion_type text NOT NULL DEFAULT 'website_change_outreach',
  title text NOT NULL,
  subject text NOT NULL,
  body_template text NOT NULL,
  reason text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.6,
  status text NOT NULL DEFAULT 'open',
  snoozed_until timestamptz NULL,
  converted_campaign_id uuid NULL REFERENCES public.email_campaigns(id),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate suggestions
CREATE UNIQUE INDEX uq_campaign_suggestions_source ON public.campaign_suggestions (org_id, source_type, source_id, suggestion_type);

-- Index for querying open suggestions
CREATE INDEX idx_campaign_suggestions_status ON public.campaign_suggestions (status, created_at DESC);
CREATE INDEX idx_campaign_suggestions_org ON public.campaign_suggestions (org_id, status);

-- campaign_suggestion_items: grouping multiple signals into one suggestion
CREATE TABLE public.campaign_suggestion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.campaign_suggestions(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_suggestion_items_suggestion ON public.campaign_suggestion_items (suggestion_id);
CREATE UNIQUE INDEX uq_suggestion_items ON public.campaign_suggestion_items (suggestion_id, signal_id);

-- Trigger for updated_at
CREATE TRIGGER set_campaign_suggestions_updated_at
  BEFORE UPDATE ON public.campaign_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.campaign_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_suggestion_items ENABLE ROW LEVEL SECURITY;

-- Suggestions are readable by authenticated users (scoped by RBAC in app layer)
CREATE POLICY "Authenticated users can view suggestions"
  ON public.campaign_suggestions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admin/regional_lead/leadership/staff can update (dismiss/snooze/convert)
CREATE POLICY "Authorized users can update suggestions"
  ON public.campaign_suggestions FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership', 'regional_lead', 'staff']::app_role[])
  );

-- Service role inserts (from edge functions / n8n-ingest)
CREATE POLICY "Service role can insert suggestions"
  ON public.campaign_suggestions FOR INSERT
  WITH CHECK (true);

-- Items: readable by authenticated
CREATE POLICY "Authenticated users can view suggestion items"
  ON public.campaign_suggestion_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert suggestion items"
  ON public.campaign_suggestion_items FOR INSERT
  WITH CHECK (true);
