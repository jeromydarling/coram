
-- =============================================
-- Phase 21Z+: Calm Digest System + Living Pulse
-- =============================================

-- 1) user_digest_preferences table
CREATE TABLE public.user_digest_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  frequency text NOT NULL DEFAULT 'weekly',
  include_visits boolean NOT NULL DEFAULT true,
  include_projects boolean NOT NULL DEFAULT true,
  include_narratives boolean NOT NULL DEFAULT true,
  include_network boolean NOT NULL DEFAULT true,
  include_system boolean NOT NULL DEFAULT false,
  include_essays boolean NOT NULL DEFAULT false,
  include_living_pulse boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for frequency
CREATE OR REPLACE FUNCTION public.validate_digest_frequency()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.frequency NOT IN ('daily','weekly','monthly','off') THEN
    RAISE EXCEPTION 'Invalid digest frequency: %', NEW.frequency;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_digest_frequency
  BEFORE INSERT OR UPDATE ON public.user_digest_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_digest_frequency();

-- RLS
ALTER TABLE public.user_digest_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own digest prefs"
  ON public.user_digest_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own digest prefs"
  ON public.user_digest_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own digest prefs"
  ON public.user_digest_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- 2) tenant_local_pulse_view (tenant-level movement summary)
CREATE OR REPLACE VIEW public.tenant_local_pulse_view WITH (security_invoker = true) AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  COALESCE(v.visits_last_7d, 0) AS visits_last_7d,
  COALESCE(p.projects_active, 0) AS projects_active,
  COALESCE(vn.voice_notes_last_7d, 0) AS voice_notes_last_7d,
  COALESCE(np.new_people_last_30d, 0) AS new_people_last_30d,
  COALESCE(ls.narrative_signals_last_30d, 0) AS narrative_signals_last_30d
FROM public.tenants t
LEFT JOIN LATERAL (
  SELECT count(*)::int AS visits_last_7d
  FROM public.activities a
  WHERE a.tenant_id = t.id
    AND a.activity_type = 'Visit'
    AND a.activity_date_time::timestamptz >= now() - interval '7 days'
) v ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS projects_active
  FROM public.activities a
  WHERE a.tenant_id = t.id
    AND a.activity_type = 'Project'
    AND COALESCE(a.project_status, 'In Progress') != 'Done'
) p ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS voice_notes_last_7d
  FROM public.voice_notes vn2
  WHERE vn2.tenant_id = t.id
    AND vn2.created_at >= now() - interval '7 days'
) vn ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS new_people_last_30d
  FROM public.contacts c
  WHERE c.tenant_id = t.id
    AND c.created_at >= now() - interval '30 days'
    AND c.deleted_at IS NULL
) np ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS narrative_signals_last_30d
  FROM public.living_system_signals lss
  WHERE lss.tenant_id = t.id
    AND lss.created_at >= now() - interval '30 days'
) ls ON true;
