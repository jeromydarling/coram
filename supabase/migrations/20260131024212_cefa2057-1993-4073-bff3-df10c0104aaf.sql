-- Fix the function search path security warning
CREATE OR REPLACE FUNCTION public.generate_slug()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  new_slug TEXT;
  counter INTEGER := 0;
  table_name TEXT;
  name_field TEXT;
BEGIN
  table_name := TG_TABLE_NAME;
  
  -- Determine which field to use for slug generation
  IF table_name = 'contacts' THEN
    name_field := NEW.name;
  ELSIF table_name = 'opportunities' THEN
    name_field := NEW.organization;
  ELSIF table_name = 'events' THEN
    name_field := NEW.event_name;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Only generate slug if it's empty or null, OR if the name field changed
  IF NEW.slug IS NULL OR NEW.slug = '' OR 
     (TG_OP = 'UPDATE' AND (
       (table_name = 'contacts' AND OLD.name IS DISTINCT FROM NEW.name) OR
       (table_name = 'opportunities' AND OLD.organization IS DISTINCT FROM NEW.organization) OR
       (table_name = 'events' AND OLD.event_name IS DISTINCT FROM NEW.event_name)
     )) THEN
    
    -- Generate base slug from name
    base_slug := lower(regexp_replace(name_field, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    
    -- Handle empty slugs
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'item';
    END IF;
    
    new_slug := base_slug;
    
    -- Check for uniqueness and add counter if needed
    LOOP
      -- Check if slug exists (excluding current record on update)
      IF TG_OP = 'UPDATE' THEN
        EXECUTE format('SELECT 1 FROM %I WHERE slug = $1 AND id != $2 LIMIT 1', table_name)
        INTO counter
        USING new_slug, NEW.id;
      ELSE
        EXECUTE format('SELECT 1 FROM %I WHERE slug = $1 LIMIT 1', table_name)
        INTO counter
        USING new_slug;
      END IF;
      
      EXIT WHEN counter IS NULL;
      
      counter := counter + 1;
      new_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := new_slug;
  END IF;
  
  RETURN NEW;
END;
$$;