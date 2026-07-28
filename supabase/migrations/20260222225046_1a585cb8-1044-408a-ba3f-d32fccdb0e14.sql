
-- Add reflection_cycle and essay_type to operator_content_drafts
ALTER TABLE operator_content_drafts
  ADD COLUMN IF NOT EXISTS reflection_cycle text,
  ADD COLUMN IF NOT EXISTS essay_type text NOT NULL DEFAULT 'narrative';

-- Auto-populate reflection_cycle from published_at or created_at
UPDATE operator_content_drafts
SET reflection_cycle = to_char(COALESCE(published_at, created_at), 'YYYY-MM')
WHERE reflection_cycle IS NULL;

-- Create trigger to auto-set reflection_cycle on insert
CREATE OR REPLACE FUNCTION public.auto_set_reflection_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reflection_cycle IS NULL THEN
    NEW.reflection_cycle := to_char(COALESCE(NEW.published_at, now()), 'YYYY-MM');
  END IF;
  IF NEW.essay_type IS NULL THEN
    NEW.essay_type := 'narrative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_reflection_cycle
BEFORE INSERT ON operator_content_drafts
FOR EACH ROW EXECUTE FUNCTION auto_set_reflection_cycle();
