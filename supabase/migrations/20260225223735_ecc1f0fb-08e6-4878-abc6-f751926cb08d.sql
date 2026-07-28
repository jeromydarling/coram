
-- Update gardener_insights validation to include resource_stewardship type
CREATE OR REPLACE FUNCTION public.validate_gardener_insight()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('essay_ready','discovery_interest','adoption_friction','onboarding_dropoff','integration_interest','familia_kinship','resource_stewardship') THEN
    RAISE EXCEPTION 'Invalid gardener_insights type: %', NEW.type;
  END IF;
  IF NEW.severity NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'Invalid gardener_insights severity: %', NEW.severity;
  END IF;
  RETURN NEW;
END; $$;
