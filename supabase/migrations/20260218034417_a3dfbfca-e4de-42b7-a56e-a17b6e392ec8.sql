
-- ============================================================
-- IMPULSUS: Tables, indexes, RLS, validation trigger
-- ============================================================

-- 1) Recursive forbidden-key checker for JSONB
CREATE OR REPLACE FUNCTION public.jsonb_contains_forbidden_keys(j jsonb, forbidden text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  k text;
  v jsonb;
  elem jsonb;
BEGIN
  IF jsonb_typeof(j) = 'object' THEN
    FOR k, v IN SELECT * FROM jsonb_each(j) LOOP
      IF k = ANY(forbidden) THEN
        RETURN true;
      END IF;
      IF jsonb_contains_forbidden_keys(v, forbidden) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(j) = 'array' THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(j) LOOP
      IF jsonb_contains_forbidden_keys(elem, forbidden) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

-- 2) impulsus_entries table
CREATE TABLE public.impulsus_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('reflection','email','campaign','ai_suggestion','event','journey','task')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  narrative text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  source jsonb NOT NULL DEFAULT '{}',
  dedupe_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE INDEX idx_impulsus_entries_user_time ON public.impulsus_entries (user_id, occurred_at DESC);
CREATE INDEX idx_impulsus_entries_opp_time ON public.impulsus_entries (opportunity_id, occurred_at DESC);
CREATE INDEX idx_impulsus_entries_metro_time ON public.impulsus_entries (metro_id, occurred_at DESC);
CREATE INDEX idx_impulsus_entries_kind_time ON public.impulsus_entries (kind, occurred_at DESC);
CREATE UNIQUE INDEX uniq_impulsus_user_dedupe ON public.impulsus_entries (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_impulsus_entries_fts ON public.impulsus_entries USING GIN (to_tsvector('english', title || ' ' || narrative));

-- 4) Validation trigger
CREATE OR REPLACE FUNCTION public.validate_impulsus_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  forbidden text[] := ARRAY['body','html','raw','full_text','note_text'];
BEGIN
  IF char_length(NEW.title) > 120 THEN
    RAISE EXCEPTION 'impulsus title exceeds 120 characters';
  END IF;
  IF char_length(NEW.narrative) > 2000 THEN
    RAISE EXCEPTION 'impulsus narrative exceeds 2000 characters';
  END IF;
  IF public.jsonb_contains_forbidden_keys(NEW.source, forbidden) THEN
    RAISE EXCEPTION 'impulsus source contains forbidden keys';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_impulsus_entry
  BEFORE INSERT OR UPDATE ON public.impulsus_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_impulsus_entry();

-- 5) RLS on impulsus_entries
ALTER TABLE public.impulsus_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own impulsus entries"
  ON public.impulsus_entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own impulsus entries"
  ON public.impulsus_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own impulsus entries"
  ON public.impulsus_entries FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own impulsus entries"
  ON public.impulsus_entries FOR DELETE
  USING (user_id = auth.uid());

-- 6) impulsus_settings table
CREATE TABLE public.impulsus_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
  capture_email_actions boolean NOT NULL DEFAULT true,
  capture_calendar_events boolean NOT NULL DEFAULT true,
  capture_ai_suggestions boolean NOT NULL DEFAULT true,
  capture_reflections boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_impulsus_settings_updated_at
  BEFORE UPDATE ON public.impulsus_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7) RLS on impulsus_settings
ALTER TABLE public.impulsus_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own impulsus settings"
  ON public.impulsus_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own impulsus settings"
  ON public.impulsus_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own impulsus settings"
  ON public.impulsus_settings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own impulsus settings"
  ON public.impulsus_settings FOR DELETE
  USING (user_id = auth.uid());
