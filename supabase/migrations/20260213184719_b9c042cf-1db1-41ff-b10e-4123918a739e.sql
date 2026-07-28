
-- ========================================================
-- PHASE 3B: Relationship Momentum Engine
-- ========================================================

-- 1) relationship_momentum table
CREATE TABLE public.relationship_momentum (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.opportunities(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  trend text NOT NULL DEFAULT 'stable' CHECK (trend IN ('rising', 'stable', 'falling')),
  drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  window_start timestamptz NOT NULL DEFAULT now(),
  window_end timestamptz NOT NULL DEFAULT now(),
  version text NOT NULL DEFAULT 'v1',
  -- Advanced alert tracking
  last_score integer NOT NULL DEFAULT 0,
  last_trend text NOT NULL DEFAULT 'stable',
  score_delta integer NOT NULL DEFAULT 0,
  last_alerted_at timestamptz NULL,
  last_alert_score integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_relationship_momentum_score ON public.relationship_momentum(score DESC);
CREATE INDEX idx_relationship_momentum_trend ON public.relationship_momentum(trend);

-- Enable RLS
ALTER TABLE public.relationship_momentum ENABLE ROW LEVEL SECURITY;

-- RLS: Admin/leadership see all; RIMs see orgs in their metros
CREATE POLICY "Admin and leadership read all momentum"
  ON public.relationship_momentum FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  );

CREATE POLICY "Users read momentum for accessible metros"
  ON public.relationship_momentum FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = relationship_momentum.organization_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- Service role manages writes (edge functions only)
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- updated_at trigger
CREATE TRIGGER update_relationship_momentum_updated_at
  BEFORE UPDATE ON public.relationship_momentum
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) proactive_notifications table (data layer for future push)
CREATE TABLE public.proactive_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  org_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('momentum_spike', 'upcoming_event', 'leadership_change', 'threshold_crossing')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proactive_notifications_user ON public.proactive_notifications(user_id, created_at DESC);
CREATE INDEX idx_proactive_notifications_org ON public.proactive_notifications(org_id);

ALTER TABLE public.proactive_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own proactive notifications"
  ON public.proactive_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own proactive notifications"
  ON public.proactive_notifications FOR UPDATE
  USING (auth.uid() = user_id);
