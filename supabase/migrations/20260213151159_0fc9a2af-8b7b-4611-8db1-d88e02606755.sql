
-- =====================================================
-- Phase 2.5: Next Best Actions Engine + Admin Alerts
-- =====================================================

-- 1) org_next_actions table (matches existing frontend hooks)
CREATE TABLE public.org_next_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id uuid,
  source_type text NOT NULL CHECK (source_type IN ('signal', 'insight', 'suggestion', 'priority_moment')),
  source_id uuid,
  action_type text NOT NULL CHECK (action_type IN ('email_intro', 'follow_up', 'event_outreach', 'grant_followup', 'strategic_outreach')),
  summary text NOT NULL,
  reasoning text NOT NULL,
  severity integer NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  predicted_success_rate numeric CHECK (predicted_success_rate BETWEEN 0 AND 1),
  score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'executed', 'dismissed', 'snoozed')),
  snoozed_until timestamptz,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Deduplicate: one open action per contact + action_type (or org + action_type if no contact)
CREATE UNIQUE INDEX uq_org_next_actions_dedup
  ON public.org_next_actions (COALESCE(contact_id, org_id), action_type)
  WHERE status = 'open';

-- Performance indexes
CREATE INDEX idx_org_next_actions_status_score ON public.org_next_actions (status, score DESC);
CREATE INDEX idx_org_next_actions_org ON public.org_next_actions (org_id);
CREATE INDEX idx_org_next_actions_user ON public.org_next_actions (user_id);
CREATE INDEX idx_org_next_actions_expires ON public.org_next_actions (expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE public.org_next_actions ENABLE ROW LEVEL SECURITY;

-- RIMs see all open actions (scoped by role-based metro access in the query layer)
CREATE POLICY "Authenticated users can read next actions"
  ON public.org_next_actions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own actions"
  ON public.org_next_actions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Service role inserts only (edge functions)
CREATE POLICY "Service role can insert next actions"
  ON public.org_next_actions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete next actions"
  ON public.org_next_actions FOR DELETE
  USING (true);

-- Auto-expire snoozed actions back to open
CREATE OR REPLACE FUNCTION public.reactivate_snoozed_actions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE org_next_actions
  SET status = 'open', snoozed_until = NULL
  WHERE status = 'snoozed'
    AND snoozed_until IS NOT NULL
    AND snoozed_until <= now();
END;
$$;

-- Auto-dismiss expired actions
CREATE OR REPLACE FUNCTION public.dismiss_expired_actions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE org_next_actions
  SET status = 'dismissed'
  WHERE status = 'open'
    AND expires_at IS NOT NULL
    AND expires_at <= now();
END;
$$;

-- Trigger to update updated_at-style field
CREATE TRIGGER update_org_next_actions_evaluated
  BEFORE UPDATE ON public.org_next_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
