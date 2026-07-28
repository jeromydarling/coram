
-- ================================================================
-- Phase 3D: People Roster Snapshots/Diffs, Event Attendance,
-- Proactive Notifications dedupe index
-- ================================================================

-- ── 3D1: people_roster_snapshots ──
CREATE TABLE IF NOT EXISTS public.people_roster_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.discovery_runs(id) ON DELETE CASCADE,
  roster jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_roster_snapshots_opp_created
  ON public.people_roster_snapshots (opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_people_roster_snapshots_run
  ON public.people_roster_snapshots (run_id);

-- Idempotency: one snapshot per (opportunity, run)
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_roster_snapshots_opp_run
  ON public.people_roster_snapshots (opportunity_id, run_id);

ALTER TABLE public.people_roster_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/leadership read all roster snapshots"
  ON public.people_roster_snapshots FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "Metro users read roster snapshots"
  ON public.people_roster_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = people_roster_snapshots.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ── 3D1: people_roster_diffs ──
CREATE TABLE IF NOT EXISTS public.people_roster_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.discovery_runs(id) ON DELETE CASCADE,
  previous_snapshot_id uuid NULL REFERENCES public.people_roster_snapshots(id) ON DELETE SET NULL,
  current_snapshot_id uuid NOT NULL REFERENCES public.people_roster_snapshots(id) ON DELETE CASCADE,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_roster_diffs_opp_created
  ON public.people_roster_diffs (opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_people_roster_diffs_run
  ON public.people_roster_diffs (run_id);

-- Idempotency: one diff per (opportunity, run)
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_roster_diffs_opp_run
  ON public.people_roster_diffs (opportunity_id, run_id);

ALTER TABLE public.people_roster_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/leadership read all roster diffs"
  ON public.people_roster_diffs FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "Metro users read roster diffs"
  ON public.people_roster_diffs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = people_roster_diffs.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ── 3D2: event_attendance ──
CREATE TABLE IF NOT EXISTS public.event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_discovered_item_id uuid NOT NULL REFERENCES public.discovered_items(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.discovery_runs(id) ON DELETE CASCADE,
  attendance_type text NOT NULL DEFAULT 'attended' CHECK (attendance_type IN ('attended','sponsoring','speaking','exhibiting')),
  evidence_url text NULL,
  evidence_snippet text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event
  ON public.event_attendance (event_discovered_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_attendance_opp
  ON public.event_attendance (opportunity_id, created_at DESC);

-- Idempotency: one attendance per (org, event)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendance_opp_event
  ON public.event_attendance (opportunity_id, event_discovered_item_id);

ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/leadership read all event attendance"
  ON public.event_attendance FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "Metro users read event attendance"
  ON public.event_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = event_attendance.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ── 3D3: Proactive notifications dedupe index ──
-- Dedupe by (user_id, notification_type, dedupe_key extracted from payload)
CREATE UNIQUE INDEX IF NOT EXISTS idx_proactive_notifications_dedupe
  ON public.proactive_notifications (user_id, notification_type, ((payload->>'dedupe_key')::text))
  WHERE payload->>'dedupe_key' IS NOT NULL;
