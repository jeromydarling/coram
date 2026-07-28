-- Create trigger function to auto-link primary contact to opportunity
CREATE OR REPLACE FUNCTION public.link_primary_contact_to_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When primary_contact_id is set or changed
  IF NEW.primary_contact_id IS NOT NULL AND 
     (OLD.primary_contact_id IS NULL OR OLD.primary_contact_id != NEW.primary_contact_id) THEN
    
    -- Update the contact to link them to this opportunity
    UPDATE public.contacts
    SET 
      opportunity_id = NEW.id,
      is_primary = true,
      updated_at = now()
    WHERE id = NEW.primary_contact_id;
    
    -- If there was a previous primary contact, unmark them as primary (but keep them linked)
    IF OLD.primary_contact_id IS NOT NULL AND OLD.primary_contact_id != NEW.primary_contact_id THEN
      UPDATE public.contacts
      SET 
        is_primary = false,
        updated_at = now()
      WHERE id = OLD.primary_contact_id
        AND opportunity_id = NEW.id;
    END IF;
  END IF;
  
  -- If primary_contact_id is removed, unmark the previous primary
  IF NEW.primary_contact_id IS NULL AND OLD.primary_contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET 
      is_primary = false,
      updated_at = now()
    WHERE id = OLD.primary_contact_id
      AND opportunity_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on opportunities table
DROP TRIGGER IF EXISTS link_primary_contact_trigger ON public.opportunities;
CREATE TRIGGER link_primary_contact_trigger
  AFTER INSERT OR UPDATE OF primary_contact_id
  ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.link_primary_contact_to_opportunity();