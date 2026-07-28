-- Add brief schedule preferences to tenants
-- brief_report_day: 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday. Default 1 (Monday)
-- brief_lookback_days: How many days to look back. Default 7.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS brief_report_day smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS brief_lookback_days smallint NOT NULL DEFAULT 7;

-- Validation trigger to keep values sane
CREATE OR REPLACE FUNCTION public.validate_brief_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.brief_report_day < 0 OR NEW.brief_report_day > 6 THEN
    RAISE EXCEPTION 'brief_report_day must be 0-6';
  END IF;
  IF NEW.brief_lookback_days < 1 OR NEW.brief_lookback_days > 90 THEN
    RAISE EXCEPTION 'brief_lookback_days must be 1-90';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_brief_schedule ON public.tenants;
CREATE TRIGGER trg_validate_brief_schedule
  BEFORE INSERT OR UPDATE OF brief_report_day, brief_lookback_days ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.validate_brief_schedule();