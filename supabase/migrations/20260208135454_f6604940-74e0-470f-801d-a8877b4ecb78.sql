
-- ============================================================
-- Phase F: Signal → Insight → Action Loop Tables
-- ============================================================

-- F1: Outreach Replies (reply detection from Gmail sync)
CREATE TABLE public.outreach_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  audience_id uuid REFERENCES public.email_campaign_audience(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  thread_id text NOT NULL,
  gmail_message_id text NOT NULL UNIQUE,
  received_at timestamptz NOT NULL,
  direction text NOT NULL DEFAULT 'inbound',
  outcome text DEFAULT NULL, -- useful | neutral | not_useful
  acknowledged_by uuid DEFAULT NULL,
  acknowledged_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_replies_campaign ON public.outreach_replies(campaign_id);
CREATE INDEX idx_outreach_replies_contact ON public.outreach_replies(contact_id);

ALTER TABLE public.outreach_replies ENABLE ROW LEVEL SECURITY;

-- RIM roles can read and acknowledge replies
CREATE POLICY "RIM roles can view replies"
  ON public.outreach_replies FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'regional_lead', 'staff', 'leadership']::app_role[]));

CREATE POLICY "RIM roles can update replies (acknowledge)"
  ON public.outreach_replies FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'regional_lead', 'staff']::app_role[]));

CREATE POLICY "Service role can insert replies"
  ON public.outreach_replies FOR INSERT
  WITH CHECK (true);

-- F3: Follow-up Suggestions
CREATE TABLE public.follow_up_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  source_type text NOT NULL, -- reply | watchlist | event
  source_id uuid NOT NULL,
  suggested_action_key text NOT NULL,
  suggested_template_key text,
  suggested_audience_type text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | dismissed | snoozed
  snoozed_until timestamptz,
  converted_campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_follow_up_suggestions_org ON public.follow_up_suggestions(org_id);
CREATE INDEX idx_follow_up_suggestions_status ON public.follow_up_suggestions(status);

ALTER TABLE public.follow_up_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RIM roles can view follow-up suggestions"
  ON public.follow_up_suggestions FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'regional_lead', 'staff', 'leadership']::app_role[]));

CREATE POLICY "RIM roles can update follow-up suggestions"
  ON public.follow_up_suggestions FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'regional_lead', 'staff']::app_role[]));

CREATE POLICY "Authenticated users can insert follow-up suggestions"
  ON public.follow_up_suggestions FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER set_follow_up_suggestions_updated_at
  BEFORE UPDATE ON public.follow_up_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
