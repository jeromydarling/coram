
-- ============================================================
-- Phase 3E: Relationship Intelligence Layer
-- ============================================================

-- 1) relationship_actions
CREATE TABLE IF NOT EXISTS public.relationship_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'reach_out','introduce','attend_event','apply_grant','follow_up','research','update_contact'
  )),
  priority_score integer NOT NULL DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
  priority_label text NOT NULL DEFAULT 'normal' CHECK (priority_label IN ('high','normal','low')),
  title text NOT NULL,
  summary text NOT NULL,
  suggested_timing text NULL,
  due_date date NULL,
  drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','done')),
  created_by_run_id uuid NULL REFERENCES public.discovery_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationship_actions_opp_created_at ON public.relationship_actions (opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_actions_priority ON public.relationship_actions (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_actions_status ON public.relationship_actions (status);
CREATE INDEX IF NOT EXISTS idx_relationship_actions_drivers ON public.relationship_actions USING GIN (drivers);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_actions_open_dedupe
  ON public.relationship_actions (opportunity_id, action_type, title)
  WHERE status = 'open';

CREATE TRIGGER update_relationship_actions_updated_at
  BEFORE UPDATE ON public.relationship_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.relationship_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all relationship_actions"
  ON public.relationship_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','regional_lead','leadership')
    )
  );

CREATE POLICY "Users with metro access can read relationship_actions"
  ON public.relationship_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_metro_assignments uma
      JOIN public.opportunities o ON o.metro_id = uma.metro_id
      WHERE uma.user_id = auth.uid() AND o.id = relationship_actions.opportunity_id
    )
  );

CREATE POLICY "Users with access can update action status"
  ON public.relationship_actions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','regional_lead','leadership')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_metro_assignments uma
      JOIN public.opportunities o ON o.metro_id = uma.metro_id
      WHERE uma.user_id = auth.uid() AND o.id = relationship_actions.opportunity_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','regional_lead','leadership')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_metro_assignments uma
      JOIN public.opportunities o ON o.metro_id = uma.metro_id
      WHERE uma.user_id = auth.uid() AND o.id = relationship_actions.opportunity_id
    )
  );

-- 2) relationship_briefings
CREATE TABLE IF NOT EXISTS public.relationship_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('metro','opportunity')),
  metro_id uuid NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  opportunity_id uuid NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  briefing_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  briefing_md text NOT NULL DEFAULT '',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_briefings_dedupe
  ON public.relationship_briefings (scope, COALESCE(metro_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid), week_start);

CREATE INDEX IF NOT EXISTS idx_relationship_briefings_scope_week ON public.relationship_briefings (scope, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_briefings_metro_week ON public.relationship_briefings (metro_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_briefings_opp_week ON public.relationship_briefings (opportunity_id, week_start DESC);

ALTER TABLE public.relationship_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all relationship_briefings"
  ON public.relationship_briefings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','regional_lead','leadership')
    )
  );

CREATE POLICY "Metro access users can read metro briefings"
  ON public.relationship_briefings FOR SELECT
  USING (
    scope = 'metro' AND EXISTS (
      SELECT 1 FROM public.user_metro_assignments uma
      WHERE uma.user_id = auth.uid() AND uma.metro_id = relationship_briefings.metro_id
    )
  );

CREATE POLICY "Metro access users can read opportunity briefings"
  ON public.relationship_briefings FOR SELECT
  USING (
    scope = 'opportunity' AND EXISTS (
      SELECT 1 FROM public.user_metro_assignments uma
      JOIN public.opportunities o ON o.metro_id = uma.metro_id
      WHERE uma.user_id = auth.uid() AND o.id = relationship_briefings.opportunity_id
    )
  );
