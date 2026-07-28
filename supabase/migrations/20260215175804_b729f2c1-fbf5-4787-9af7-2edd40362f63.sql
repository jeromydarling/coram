
-- PHASE 5B PART 1A: Schema changes (columns + tables only)

-- 1) Add home_metro_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_home_metro ON public.profiles (home_metro_id) WHERE home_metro_id IS NOT NULL;

-- 2) Add missing columns to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS attended_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS attended_by uuid NULL,
  ADD COLUMN IF NOT EXISTS is_local_pulse boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_events_local_pulse ON public.events (metro_id, event_date DESC) WHERE is_local_pulse = true;
CREATE INDEX IF NOT EXISTS idx_events_attended ON public.events (attended_by, attended_at DESC) WHERE attended_at IS NOT NULL;

-- 3) Local Pulse Sources
CREATE TABLE IF NOT EXISTS public.local_pulse_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('auto','url')),
  url text NULL,
  label text NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz NULL,
  last_status text NULL CHECK (last_status IN ('ok','warning','failed')),
  last_error text NULL,
  detected_feed_type text NULL CHECK (detected_feed_type IN ('rss','ics','html','unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT url_required_for_url_type CHECK (source_type != 'url' OR url IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_local_pulse_sources_user_metro_url
  ON public.local_pulse_sources (user_id, metro_id, url)
  WHERE url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lps_user_metro ON public.local_pulse_sources (user_id, metro_id);
CREATE INDEX IF NOT EXISTS idx_lps_metro_enabled ON public.local_pulse_sources (metro_id, enabled);
CREATE INDEX IF NOT EXISTS idx_lps_last_checked ON public.local_pulse_sources (last_checked_at DESC);

CREATE TRIGGER set_local_pulse_sources_updated_at
  BEFORE UPDATE ON public.local_pulse_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.local_pulse_sources ENABLE ROW LEVEL SECURITY;

-- 4) Local Pulse Runs
CREATE TABLE IF NOT EXISTS public.local_pulse_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  user_id uuid NULL,
  run_kind text NOT NULL CHECK (run_kind IN ('scheduled','manual')),
  status text NOT NULL CHECK (status IN ('running','completed','failed')) DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  stats jsonb NOT NULL DEFAULT '{}',
  error jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lpr_metro_created ON public.local_pulse_runs (metro_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lpr_status_created ON public.local_pulse_runs (status, created_at DESC);

ALTER TABLE public.local_pulse_runs ENABLE ROW LEVEL SECURITY;

-- 5) Event Reflections
CREATE TABLE IF NOT EXISTS public.event_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  opportunity_id uuid NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) <= 6000),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','team')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_event ON public.event_reflections (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_er_opportunity ON public.event_reflections (opportunity_id, created_at DESC) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_er_author ON public.event_reflections (author_id, created_at DESC);

CREATE TRIGGER set_event_reflections_updated_at
  BEFORE UPDATE ON public.event_reflections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.event_reflections ENABLE ROW LEVEL SECURITY;

-- 6) Event Reflection Extractions
CREATE TABLE IF NOT EXISTS public.event_reflection_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id uuid UNIQUE NOT NULL REFERENCES public.event_reflections(id) ON DELETE CASCADE,
  topics text[] NOT NULL DEFAULT '{}',
  signals jsonb NOT NULL DEFAULT '[]',
  partner_mentions text[] NOT NULL DEFAULT '{}',
  summary_safe text NOT NULL DEFAULT '',
  model text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT summary_safe_max_len CHECK (char_length(summary_safe) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_ere_created ON public.event_reflection_extractions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ere_topics ON public.event_reflection_extractions USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_ere_signals ON public.event_reflection_extractions USING GIN (signals);

CREATE TRIGGER set_event_reflection_extractions_updated_at
  BEFORE UPDATE ON public.event_reflection_extractions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.event_reflection_extractions ENABLE ROW LEVEL SECURITY;
