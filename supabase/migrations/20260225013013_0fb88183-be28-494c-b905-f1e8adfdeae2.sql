
-- 1) Add new columns to activities for Projects (and Visits benefit too)
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS parent_activity_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS project_status text;

-- 2) Self-referencing FK for parent/child activity hierarchy
ALTER TABLE public.activities
  ADD CONSTRAINT activities_parent_activity_fk
  FOREIGN KEY (parent_activity_id)
  REFERENCES public.activities(id)
  ON DELETE SET NULL;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_activities_parent_activity_id
  ON public.activities(parent_activity_id);

CREATE INDEX IF NOT EXISTS idx_activities_type_date
  ON public.activities(activity_type, activity_date_time DESC);

-- 4) Add 'Project' and 'Project Note' to activity_type enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Project';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Project Note';

-- 5) Validation trigger for project_status
CREATE OR REPLACE FUNCTION public.validate_project_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.project_status IS NOT NULL AND NEW.project_status NOT IN ('Planned', 'In Progress', 'Done') THEN
    RAISE EXCEPTION 'Invalid project_status: %', NEW.project_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_project_status
  BEFORE INSERT OR UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_project_status();
