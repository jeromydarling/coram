
-- Phase 4B: Metro Narrative Engine

-- 1) Create metro_narratives table
CREATE TABLE public.metro_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  headline text,
  narrative_md text,
  narrative_json jsonb DEFAULT '{}'::jsonb,
  source_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  ai_generated boolean NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX idx_metro_narratives_metro_time ON public.metro_narratives (metro_id, created_at DESC);
CREATE INDEX idx_metro_narratives_json ON public.metro_narratives USING GIN (narrative_json);

-- RLS
ALTER TABLE public.metro_narratives ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/leadership/regional_lead read all; metro-scoped users read their metros
CREATE POLICY "Admins read all metro narratives"
  ON public.metro_narratives FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'regional_lead'::app_role])
  );

CREATE POLICY "Metro users read their narratives"
  ON public.metro_narratives FOR SELECT
  USING (
    public.has_metro_access(auth.uid(), metro_id)
  );

-- No INSERT/UPDATE/DELETE for authenticated users (service role only)

-- 2) Extend proactive_notifications constraint to include metro_narrative_update
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
    'relationship_story_update'::text,
    'discovery_event'::text,
    'discovery_grant'::text,
    'discovery_people'::text,
    'metro_narrative_update'::text
  ]));
