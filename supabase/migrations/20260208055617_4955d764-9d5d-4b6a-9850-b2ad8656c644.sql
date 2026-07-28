
-- ═══════════════════════════════════════════════════════
-- PHASE F5: Send Intent + Risk Evaluation tables
-- ═══════════════════════════════════════════════════════

-- 1) Send Intents
CREATE TABLE public.email_campaign_send_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  intent_status text NOT NULL DEFAULT 'proposed'
    CHECK (intent_status IN ('proposed','acknowledged','consumed','expired')),
  rationale text NOT NULL DEFAULT '',
  risk_level text NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high')),
  risk_reasons text[] NOT NULL DEFAULT '{}'::text[],
  requires_ack boolean NOT NULL DEFAULT false,
  acked_at timestamptz NULL,
  consumed_at timestamptz NULL,
  expires_at timestamptz NOT NULL
);

-- Only one active (proposed or acknowledged) intent per campaign
CREATE UNIQUE INDEX uq_active_intent_per_campaign
  ON public.email_campaign_send_intents (campaign_id)
  WHERE intent_status IN ('proposed','acknowledged');

CREATE INDEX idx_send_intents_campaign ON public.email_campaign_send_intents(campaign_id);

-- RLS
ALTER TABLE public.email_campaign_send_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intents"
  ON public.email_campaign_send_intents FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create intents"
  ON public.email_campaign_send_intents FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own intents"
  ON public.email_campaign_send_intents FOR UPDATE
  USING (created_by = auth.uid());

-- 2) Risk Evaluation Cache
CREATE TABLE public.email_campaign_risk_eval (
  campaign_id uuid PRIMARY KEY REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  risk_level text NOT NULL,
  risk_reasons text[] NOT NULL,
  audience_size int NOT NULL,
  transient_failure_rate numeric NULL,
  org_success_rate numeric NULL,
  subject_reuse_count int NULL,
  inputs_hash text NOT NULL
);

ALTER TABLE public.email_campaign_risk_eval ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk eval for own campaigns"
  ON public.email_campaign_risk_eval FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_campaigns c
      WHERE c.id = campaign_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can upsert risk eval for own campaigns"
  ON public.email_campaign_risk_eval FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_campaigns c
      WHERE c.id = campaign_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update risk eval for own campaigns"
  ON public.email_campaign_risk_eval FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.email_campaigns c
      WHERE c.id = campaign_id AND c.created_by = auth.uid()
    )
  );
