
-- Auto-advance opportunity to 'Discovery Held' when an attended meeting is detected
CREATE OR REPLACE FUNCTION public.auto_advance_to_discovery_held()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_stage text;
  v_early_stages text[] := ARRAY['Target Identified', 'Contacted', 'Discovery Scheduled'];
BEGIN
  -- Only fire when attended is set to true and there's a linked opportunity
  IF NEW.attended = true AND NEW.opportunity_id IS NOT NULL
     AND (OLD.attended IS DISTINCT FROM NEW.attended OR TG_OP = 'INSERT')
  THEN
    -- Check current opportunity stage
    SELECT stage INTO v_current_stage
    FROM public.opportunities
    WHERE id = NEW.opportunity_id;

    -- Only advance if in an early stage
    IF v_current_stage = ANY(v_early_stages) THEN
      UPDATE public.opportunities
      SET stage = 'Discovery Held',
          updated_at = now()
      WHERE id = NEW.opportunity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on activities table (covers CRM-logged meetings)
CREATE TRIGGER trg_auto_advance_discovery_held
AFTER INSERT OR UPDATE OF attended ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_to_discovery_held();

-- Also trigger on google_calendar_events (covers Google Calendar meetings)
CREATE OR REPLACE FUNCTION public.auto_advance_discovery_held_gcal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_stage text;
  v_opp_id uuid;
  v_early_stages text[] := ARRAY['Target Identified', 'Contacted', 'Discovery Scheduled'];
BEGIN
  -- Only fire when attended is set to true and there's a linked contact
  IF NEW.attended = true AND NEW.contact_id IS NOT NULL
     AND (OLD.attended IS DISTINCT FROM NEW.attended OR TG_OP = 'INSERT')
  THEN
    -- Find opportunity via the contact
    SELECT opportunity_id INTO v_opp_id
    FROM public.contacts
    WHERE id = NEW.contact_id
      AND opportunity_id IS NOT NULL
    LIMIT 1;

    IF v_opp_id IS NOT NULL THEN
      SELECT stage INTO v_current_stage
      FROM public.opportunities
      WHERE id = v_opp_id;

      IF v_current_stage = ANY(v_early_stages) THEN
        UPDATE public.opportunities
        SET stage = 'Discovery Held',
            updated_at = now()
        WHERE id = v_opp_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_advance_discovery_held_gcal
AFTER INSERT OR UPDATE OF attended ON public.google_calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_discovery_held_gcal();
