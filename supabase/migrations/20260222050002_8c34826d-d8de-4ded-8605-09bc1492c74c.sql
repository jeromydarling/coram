CREATE OR REPLACE FUNCTION public.validate_lumen_signal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.signal_type NOT IN ('drift_risk','activation_delay','migration_fragility','volunteer_dropoff','expansion_ready','narrative_surge','capacity_growth') THEN
    RAISE EXCEPTION 'Invalid lumen signal_type: %', NEW.signal_type;
  END IF;
  IF NEW.severity NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'Invalid lumen severity: %', NEW.severity;
  END IF;
  RETURN NEW;
END;
$function$;