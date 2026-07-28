
-- ═══════════════════════════════════════════════════════════
-- INDOLES MODULE — Phase 1: All column additions + zodiac trigger
-- ═══════════════════════════════════════════════════════════

-- ── contacts table additions ──
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS zodiac_sign TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS zodiac_element TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS zodiac_modality TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS enneagram_type INTEGER;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS enneagram_wing INTEGER;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS enneagram_confidence INTEGER;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS enneagram_scores JSONB;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS enneagram_source TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS clifton_strengths JSONB;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS disc_profile TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';

-- ── profiles table additions ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zodiac_sign TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zodiac_element TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zodiac_modality TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enneagram_type INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enneagram_wing INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enneagram_confidence INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enneagram_scores JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enneagram_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clifton_strengths JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disc_profile TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personality_visibility TEXT DEFAULT 'private';

-- ── volunteers table additions ──
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS zodiac_sign TEXT;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS zodiac_element TEXT;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS zodiac_modality TEXT;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS enneagram_type INTEGER;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS enneagram_wing INTEGER;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS enneagram_confidence INTEGER;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS enneagram_scores JSONB;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS enneagram_source TEXT;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS clifton_strengths JSONB;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS disc_profile TEXT;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]';
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS comfort_areas JSONB DEFAULT '[]';
ALTER TABLE public.volunteers ADD COLUMN IF NOT EXISTS availability_notes TEXT;

-- ═══════════════════════════════════════════════════════════
-- Combined zodiac derivation + validation trigger (Refinement #1)
-- Single function, three tables
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.derive_zodiac_from_dob()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m INTEGER;
  d INTEGER;
  v_sign TEXT;
  v_element TEXT;
  v_modality TEXT;
  allowed_elements TEXT[] := ARRAY['Fire', 'Earth', 'Air', 'Water'];
  allowed_modalities TEXT[] := ARRAY['Cardinal', 'Fixed', 'Mutable'];
BEGIN
  -- If date_of_birth is NULL, clear zodiac fields
  IF NEW.date_of_birth IS NULL THEN
    NEW.zodiac_sign := NULL;
    NEW.zodiac_element := NULL;
    NEW.zodiac_modality := NULL;
    RETURN NEW;
  END IF;

  m := EXTRACT(MONTH FROM NEW.date_of_birth);
  d := EXTRACT(DAY FROM NEW.date_of_birth);

  -- Derive sign, element, modality
  CASE
    WHEN (m = 3 AND d >= 21) OR (m = 4 AND d <= 19) THEN
      v_sign := 'Aries'; v_element := 'Fire'; v_modality := 'Cardinal';
    WHEN (m = 4 AND d >= 20) OR (m = 5 AND d <= 20) THEN
      v_sign := 'Taurus'; v_element := 'Earth'; v_modality := 'Fixed';
    WHEN (m = 5 AND d >= 21) OR (m = 6 AND d <= 20) THEN
      v_sign := 'Gemini'; v_element := 'Air'; v_modality := 'Mutable';
    WHEN (m = 6 AND d >= 21) OR (m = 7 AND d <= 22) THEN
      v_sign := 'Cancer'; v_element := 'Water'; v_modality := 'Cardinal';
    WHEN (m = 7 AND d >= 23) OR (m = 8 AND d <= 22) THEN
      v_sign := 'Leo'; v_element := 'Fire'; v_modality := 'Fixed';
    WHEN (m = 8 AND d >= 23) OR (m = 9 AND d <= 22) THEN
      v_sign := 'Virgo'; v_element := 'Earth'; v_modality := 'Mutable';
    WHEN (m = 9 AND d >= 23) OR (m = 10 AND d <= 22) THEN
      v_sign := 'Libra'; v_element := 'Air'; v_modality := 'Cardinal';
    WHEN (m = 10 AND d >= 23) OR (m = 11 AND d <= 21) THEN
      v_sign := 'Scorpio'; v_element := 'Water'; v_modality := 'Fixed';
    WHEN (m = 11 AND d >= 22) OR (m = 12 AND d <= 21) THEN
      v_sign := 'Sagittarius'; v_element := 'Fire'; v_modality := 'Mutable';
    WHEN (m = 12 AND d >= 22) OR (m = 1 AND d <= 19) THEN
      v_sign := 'Capricorn'; v_element := 'Earth'; v_modality := 'Cardinal';
    WHEN (m = 1 AND d >= 20) OR (m = 2 AND d <= 18) THEN
      v_sign := 'Aquarius'; v_element := 'Air'; v_modality := 'Fixed';
    WHEN (m = 2 AND d >= 19) OR (m = 3 AND d <= 20) THEN
      v_sign := 'Pisces'; v_element := 'Water'; v_modality := 'Mutable';
    ELSE
      v_sign := NULL; v_element := NULL; v_modality := NULL;
  END CASE;

  NEW.zodiac_sign := v_sign;
  NEW.zodiac_element := v_element;
  NEW.zodiac_modality := v_modality;

  -- Validation guard: if someone manually wrote invalid values, reject
  IF NEW.zodiac_element IS NOT NULL AND NOT (NEW.zodiac_element = ANY(allowed_elements)) THEN
    RAISE EXCEPTION 'Invalid zodiac_element: %. Must be one of: Fire, Earth, Air, Water', NEW.zodiac_element;
  END IF;
  IF NEW.zodiac_modality IS NOT NULL AND NOT (NEW.zodiac_modality = ANY(allowed_modalities)) THEN
    RAISE EXCEPTION 'Invalid zodiac_modality: %. Must be one of: Cardinal, Fixed, Mutable', NEW.zodiac_modality;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to all three tables
DROP TRIGGER IF EXISTS trg_derive_zodiac_contacts ON public.contacts;
CREATE TRIGGER trg_derive_zodiac_contacts
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.derive_zodiac_from_dob();

DROP TRIGGER IF EXISTS trg_derive_zodiac_profiles ON public.profiles;
CREATE TRIGGER trg_derive_zodiac_profiles
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.derive_zodiac_from_dob();

DROP TRIGGER IF EXISTS trg_derive_zodiac_volunteers ON public.volunteers;
CREATE TRIGGER trg_derive_zodiac_volunteers
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.volunteers
  FOR EACH ROW EXECUTE FUNCTION public.derive_zodiac_from_dob();
