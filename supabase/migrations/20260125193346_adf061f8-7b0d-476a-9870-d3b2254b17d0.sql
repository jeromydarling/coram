-- Create a function to call the milestone notification edge function
CREATE OR REPLACE FUNCTION public.notify_pipeline_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  old_stage text;
  new_stage text;
  metro_name text;
BEGIN
  old_stage := COALESCE(OLD.stage::text, '');
  new_stage := NEW.stage::text;
  
  -- Only notify on milestone stages: Agreement Signed, First Volume
  IF new_stage IN ('Agreement Signed', 'First Volume') AND old_stage != new_stage THEN
    -- Get metro name
    SELECT metro INTO metro_name
    FROM public.metros
    WHERE id = NEW.metro_id;
    
    -- Call the edge function via pg_net (async HTTP call)
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/notify-pipeline-milestone',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'pipeline_id', NEW.id,
        'pipeline_name', NEW.anchor_pipeline_id,
        'stage', new_stage,
        'owner_id', NEW.owner_id,
        'metro_name', metro_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for pipeline milestone notifications
DROP TRIGGER IF EXISTS trigger_pipeline_milestone_notification ON public.anchor_pipeline;

CREATE TRIGGER trigger_pipeline_milestone_notification
AFTER UPDATE OF stage ON public.anchor_pipeline
FOR EACH ROW
EXECUTE FUNCTION public.notify_pipeline_milestone();