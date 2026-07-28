
-- Create trigger function to auto-update stage_entry_date when stage changes
CREATE OR REPLACE FUNCTION public.update_pipeline_stage_entry_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only update stage_entry_date if stage actually changed
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_entry_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on anchor_pipeline table
CREATE TRIGGER trigger_pipeline_stage_entry_date
  BEFORE UPDATE ON public.anchor_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipeline_stage_entry_date();
