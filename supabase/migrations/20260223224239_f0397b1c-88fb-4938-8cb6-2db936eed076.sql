
-- ═══════════════════════════════════════════════════════
-- Phase 21T(B): Narrative Companion Mode — Data Model
-- ═══════════════════════════════════════════════════════

-- 1) Add companion mode columns to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS companion_mode_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS companion_mode_allow_users boolean NOT NULL DEFAULT true;

-- 2) user_preferences table for per-user companion toggle
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  companion_mode_enabled boolean NOT NULL DEFAULT false,
  companion_mode_dismissed_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- 3) micro_guidance_events for adoption telemetry
CREATE TABLE IF NOT EXISTS public.micro_guidance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  archetype_key text NULL,
  route text NOT NULL,
  guide_key text NOT NULL,
  trigger_type text NOT NULL,
  action text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.micro_guidance_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own guidance events"
  ON public.micro_guidance_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own events (for dedup/dismissal checks)
CREATE POLICY "Users can read own guidance events"
  ON public.micro_guidance_events FOR SELECT
  USING (auth.uid() = user_id);

-- Validation trigger for trigger_type
CREATE OR REPLACE FUNCTION public.validate_micro_guidance_event()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $func$
BEGIN
  IF NEW.trigger_type NOT IN ('friction_idle','friction_rage_click','first_time_page','repeat_attempt','manual_open') THEN
    RAISE EXCEPTION 'Invalid micro_guidance_events trigger_type: %', NEW.trigger_type;
  END IF;
  IF NEW.action NOT IN ('shown','accepted','dismissed','snoozed') THEN
    RAISE EXCEPTION 'Invalid micro_guidance_events action: %', NEW.action;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_validate_micro_guidance_event
  BEFORE INSERT OR UPDATE ON public.micro_guidance_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_micro_guidance_event();

-- Index for operator aggregate queries
CREATE INDEX IF NOT EXISTS idx_micro_guidance_events_tenant_created
  ON public.micro_guidance_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_micro_guidance_events_guide_key
  ON public.micro_guidance_events (guide_key, action);
