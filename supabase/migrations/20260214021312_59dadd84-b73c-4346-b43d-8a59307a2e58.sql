
-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4A: Relationship Story — Tables, Indexes, RLS, Functions
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Extend proactive_notifications constraint
ALTER TABLE public.proactive_notifications
  DROP CONSTRAINT IF EXISTS proactive_notifications_notification_type_check;

ALTER TABLE public.proactive_notifications
  ADD CONSTRAINT proactive_notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'momentum_spike'::text,
    'upcoming_event'::text,
    'leadership_change'::text,
    'threshold_crossing'::text,
    'relationship_action_high_priority'::text,
    'relationship_story_update'::text
  ]));

-- 2) relationship_story_chapters
CREATE TABLE public.relationship_story_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  family text NOT NULL CHECK (family IN ('leadership','programs','ecosystem','funding','events','relationship')),
  chapter_title text NOT NULL,
  chapter_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_chapters_opportunity ON public.relationship_story_chapters (opportunity_id, chapter_order);
CREATE UNIQUE INDEX idx_story_chapters_opp_family ON public.relationship_story_chapters (opportunity_id, family);

CREATE TRIGGER update_story_chapters_updated_at
  BEFORE UPDATE ON public.relationship_story_chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.relationship_story_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_chapters_select"
  ON public.relationship_story_chapters FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = relationship_story_chapters.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- 3) relationship_story_updates
CREATE TABLE public.relationship_story_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.relationship_story_chapters(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  delta_type text NOT NULL CHECK (delta_type IN ('reinforcement','shift','new_signal','correction','noop')),
  confidence numeric NOT NULL DEFAULT 0.6 CHECK (confidence >= 0 AND confidence <= 1),
  summary_md text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_used boolean NOT NULL DEFAULT false,
  version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_updates_chapter_time ON public.relationship_story_updates (chapter_id, generated_at DESC);
CREATE INDEX idx_story_updates_opportunity_time ON public.relationship_story_updates (opportunity_id, generated_at DESC);
CREATE INDEX idx_story_updates_evidence ON public.relationship_story_updates USING GIN (evidence);

ALTER TABLE public.relationship_story_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_updates_select"
  ON public.relationship_story_updates FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = relationship_story_updates.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- 4) ensure_story_chapters function (idempotent)
CREATE OR REPLACE FUNCTION public.ensure_story_chapters(p_opportunity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.relationship_story_chapters (opportunity_id, family, chapter_title, chapter_order)
  VALUES
    (p_opportunity_id, 'leadership',    'Leadership Evolution',      10),
    (p_opportunity_id, 'programs',      'Programs & Services',       20),
    (p_opportunity_id, 'ecosystem',     'Ecosystem & Partnerships',  30),
    (p_opportunity_id, 'funding',       'Funding & Grants',          40),
    (p_opportunity_id, 'events',        'Events & Presence',         50),
    (p_opportunity_id, 'relationship',  'Relationship Arc',          60)
  ON CONFLICT (opportunity_id, family) DO NOTHING;
END;
$$;
