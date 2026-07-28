
-- Function: advance opportunity from Found → First Conversation when an email is sent
CREATE OR REPLACE FUNCTION public.advance_stage_on_email_sent()
RETURNS TRIGGER AS $$
DECLARE
  v_opportunity_id uuid;
  v_current_stage text;
BEGIN
  -- Only act when status becomes 'sent'
  IF NEW.status <> 'sent' THEN
    RETURN NEW;
  END IF;

  -- Skip if no contact linked
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the opportunity for this contact
  SELECT opportunity_id INTO v_opportunity_id
  FROM public.contacts
  WHERE id = NEW.contact_id
  LIMIT 1;

  IF v_opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check current stage
  SELECT stage INTO v_current_stage
  FROM public.opportunities
  WHERE id = v_opportunity_id;

  -- Advance only from Found/Target Identified
  IF v_current_stage IN ('Target Identified', 'Found') THEN
    UPDATE public.opportunities
    SET stage = 'Contacted',
        updated_at = now()
    WHERE id = v_opportunity_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on email_campaign_audience
CREATE TRIGGER trg_advance_stage_on_email_sent
AFTER INSERT OR UPDATE OF status ON public.email_campaign_audience
FOR EACH ROW
EXECUTE FUNCTION public.advance_stage_on_email_sent();
