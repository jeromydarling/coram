
-- outreach_drafts: stores AI-generated outreach drafts with mode + alternates
CREATE TABLE public.outreach_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  outreach_mode text NOT NULL CHECK (outreach_mode IN ('partnership_intro', 'grant_collaboration', 'event_networking', 'leadership_intro', 'follow_up')),
  run_id uuid UNIQUE,
  subject text NOT NULL,
  body_html text NOT NULL,
  alternates jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_json jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('generating', 'draft', 'applied', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_drafts_campaign ON public.outreach_drafts (campaign_id);
CREATE INDEX idx_outreach_drafts_opportunity ON public.outreach_drafts (opportunity_id);

ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;

-- Users can read their own drafts
CREATE POLICY "Users can read own outreach drafts"
ON public.outreach_drafts FOR SELECT TO authenticated
USING (created_by = auth.uid());

-- No direct INSERT/UPDATE/DELETE by users — service role only via edge functions
