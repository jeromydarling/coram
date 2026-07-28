-- Add editorial_mode, movement_source, month_tag to operator_content_drafts
ALTER TABLE public.operator_content_drafts
  ADD COLUMN IF NOT EXISTS editorial_mode text NOT NULL DEFAULT 'long_essay',
  ADD COLUMN IF NOT EXISTS movement_source text,
  ADD COLUMN IF NOT EXISTS month_tag text;

-- Validate editorial_mode values
CREATE OR REPLACE FUNCTION public.validate_editorial_mode()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.editorial_mode NOT IN ('long_essay', 'monthly_reflection', 'field_note', 'operator_insight', 'silence') THEN
    RAISE EXCEPTION 'Invalid editorial_mode: %', NEW.editorial_mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_editorial_mode ON public.operator_content_drafts;
CREATE TRIGGER trg_validate_editorial_mode
  BEFORE INSERT OR UPDATE ON public.operator_content_drafts
  FOR EACH ROW EXECUTE FUNCTION public.validate_editorial_mode();

-- Editorial recommendations table for Operator Nexus
CREATE TABLE IF NOT EXISTS public.editorial_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  editorial_mode text NOT NULL DEFAULT 'long_essay',
  title text NOT NULL,
  reason text NOT NULL,
  movement_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_count integer NOT NULL DEFAULT 0,
  signal_strength text NOT NULL DEFAULT 'moderate',
  status text NOT NULL DEFAULT 'pending',
  acted_at timestamptz,
  acted_by uuid,
  created_draft_id uuid REFERENCES public.operator_content_drafts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validate editorial recommendation status
CREATE OR REPLACE FUNCTION public.validate_editorial_recommendation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'drafted', 'waiting', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid editorial_recommendations status: %', NEW.status;
  END IF;
  IF NEW.signal_strength NOT IN ('low', 'moderate', 'strong') THEN
    RAISE EXCEPTION 'Invalid editorial_recommendations signal_strength: %', NEW.signal_strength;
  END IF;
  IF NEW.editorial_mode NOT IN ('long_essay', 'monthly_reflection', 'field_note', 'operator_insight', 'silence') THEN
    RAISE EXCEPTION 'Invalid editorial_recommendations editorial_mode: %', NEW.editorial_mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_editorial_recommendation ON public.editorial_recommendations;
CREATE TRIGGER trg_validate_editorial_recommendation
  BEFORE INSERT OR UPDATE ON public.editorial_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.validate_editorial_recommendation();

-- RLS
ALTER TABLE public.editorial_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view editorial recommendations"
  ON public.editorial_recommendations FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[]));

CREATE POLICY "Operators can manage editorial recommendations"
  ON public.editorial_recommendations FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::public.app_role[]));