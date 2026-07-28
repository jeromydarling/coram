
-- Life Events table
CREATE TABLE public.life_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid NOT NULL REFERENCES public.contacts(id),
  event_type text NOT NULL,
  event_date date NOT NULL,
  title text,
  description text,
  visibility text NOT NULL DEFAULT 'tenant_only',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for event_type
CREATE OR REPLACE FUNCTION public.validate_life_event()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type NOT IN (
    'marriage','birth','adoption','graduation','ordination','retirement',
    'anniversary','milestone','sobriety_milestone','relapse','hospitalization',
    'recovery','care_completed','death'
  ) THEN
    RAISE EXCEPTION 'Invalid life_events event_type: %', NEW.event_type;
  END IF;
  IF NEW.visibility NOT IN ('private','tenant_only','familia_aggregate','communio_aggregate') THEN
    RAISE EXCEPTION 'Invalid life_events visibility: %', NEW.visibility;
  END IF;
  -- Enforce default visibility for sensitive types
  IF NEW.visibility IS NULL OR NEW.visibility = '' THEN
    CASE NEW.event_type
      WHEN 'death' THEN NEW.visibility := 'tenant_only';
      WHEN 'relapse' THEN NEW.visibility := 'private';
      WHEN 'sobriety_milestone' THEN NEW.visibility := 'tenant_only';
      ELSE NEW.visibility := 'tenant_only';
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_life_event
  BEFORE INSERT OR UPDATE ON public.life_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_life_event();

-- Indexes
CREATE INDEX idx_life_events_person ON public.life_events(person_id);
CREATE INDEX idx_life_events_tenant ON public.life_events(tenant_id);
CREATE INDEX idx_life_events_type ON public.life_events(event_type);

-- RLS
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view non-private life events"
  ON public.life_events FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    AND (visibility != 'private' OR created_by = auth.uid())
  );

CREATE POLICY "Tenant members can insert life events"
  ON public.life_events FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Authors can update their life events"
  ON public.life_events FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Authors can delete their life events"
  ON public.life_events FOR DELETE
  USING (created_by = auth.uid());
