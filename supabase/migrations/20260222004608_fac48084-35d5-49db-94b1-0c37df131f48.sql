
-- narrative_stories: operator-curated stories published to marketing site
CREATE TABLE public.narrative_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  role text,
  archetype text,
  pattern_source jsonb DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_narrative_story_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid narrative_stories status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_narrative_story_status
  BEFORE INSERT OR UPDATE ON public.narrative_stories
  FOR EACH ROW EXECUTE FUNCTION public.validate_narrative_story_status();

-- Auto-update updated_at
CREATE TRIGGER trg_narrative_stories_updated_at
  BEFORE UPDATE ON public.narrative_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.narrative_stories ENABLE ROW LEVEL SECURITY;

-- Public read for published stories
CREATE POLICY "Anyone can read published stories"
  ON public.narrative_stories FOR SELECT
  USING (status = 'published');

-- Operators (admin) can do everything
CREATE POLICY "Admins can manage all stories"
  ON public.narrative_stories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
