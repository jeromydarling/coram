
-- Trigger: advance stage when a Gmail-synced email is recorded for a contact
-- whose opportunity is still in Found / Target Identified
CREATE OR REPLACE FUNCTION public.advance_stage_on_email_communication()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_opportunity_id uuid;
  v_current_stage text;
BEGIN
  -- Only act on INSERT (new synced email)
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT opportunity_id INTO v_opportunity_id
  FROM public.contacts
  WHERE id = NEW.contact_id
  LIMIT 1;

  IF v_opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO v_current_stage
  FROM public.opportunities
  WHERE id = v_opportunity_id;

  IF v_current_stage IN ('Target Identified', 'Found') THEN
    UPDATE public.opportunities
    SET stage = 'Contacted',
        updated_at = now()
    WHERE id = v_opportunity_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_advance_stage_on_email_communication
  AFTER INSERT ON public.email_communications
  FOR EACH ROW
  EXECUTE FUNCTION public.advance_stage_on_email_communication();

-- Fix Smart North's current stage now
UPDATE public.opportunities
SET stage = 'Contacted', updated_at = now()
WHERE id = '45749940-da4b-4afc-8434-6a5cb1726df3'
  AND stage = 'Target Identified';
