-- Create function to auto-create pipeline entry when opportunity reaches Discovery Held
CREATE OR REPLACE FUNCTION public.auto_create_pipeline_on_opportunity_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_pipeline_count INTEGER;
  new_pipeline_id TEXT;
BEGIN
  -- Only trigger when stage changes TO 'Discovery Held'
  IF NEW.stage = 'Discovery Held' AND (OLD.stage IS NULL OR OLD.stage != 'Discovery Held') THEN
    -- Check if a pipeline entry already exists for this opportunity
    SELECT COUNT(*) INTO existing_pipeline_count
    FROM public.anchor_pipeline
    WHERE opportunity_id = NEW.id;
    
    -- Only create if no existing pipeline entry
    IF existing_pipeline_count = 0 THEN
      -- Generate a unique pipeline ID
      new_pipeline_id := 'PL-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
      
      -- Create the pipeline entry
      INSERT INTO public.anchor_pipeline (
        anchor_pipeline_id,
        opportunity_id,
        metro_id,
        owner_id,
        stage,
        stage_entry_date,
        probability
      ) VALUES (
        new_pipeline_id,
        NEW.id,
        NEW.metro_id,
        NEW.owner_id,
        'Discovery Held',
        CURRENT_DATE,
        30  -- Default probability for Discovery Held
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on opportunities table
DROP TRIGGER IF EXISTS auto_create_pipeline_trigger ON public.opportunities;
CREATE TRIGGER auto_create_pipeline_trigger
  AFTER UPDATE OF stage ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_pipeline_on_opportunity_stage();

-- Also trigger on INSERT for new opportunities created directly at Discovery Held stage
DROP TRIGGER IF EXISTS auto_create_pipeline_on_insert_trigger ON public.opportunities;
CREATE TRIGGER auto_create_pipeline_on_insert_trigger
  AFTER INSERT ON public.opportunities
  FOR EACH ROW
  WHEN (NEW.stage = 'Discovery Held')
  EXECUTE FUNCTION public.auto_create_pipeline_on_opportunity_stage();