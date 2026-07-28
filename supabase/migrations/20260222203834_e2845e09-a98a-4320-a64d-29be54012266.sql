
-- operator_import_notices: stores coverage-mode analysis after each Relatio import
CREATE TABLE public.operator_import_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  coverage_mode text NOT NULL DEFAULT 'A',
  contact_count integer NOT NULL DEFAULT 0,
  partner_count integer NOT NULL DEFAULT 0,
  household_count integer NOT NULL DEFAULT 0,
  has_notes boolean NOT NULL DEFAULT false,
  has_events boolean NOT NULL DEFAULT false,
  has_activities boolean NOT NULL DEFAULT false,
  adoption_momentum_score integer NOT NULL DEFAULT 0,
  suggested_playbooks text[] NOT NULL DEFAULT '{}',
  narrative_summary text NOT NULL DEFAULT '',
  source_connector text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_import_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage import notices"
  ON public.operator_import_notices
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add adoption_momentum column to operator_tenant_stats
ALTER TABLE public.operator_tenant_stats
  ADD COLUMN IF NOT EXISTS adoption_momentum integer DEFAULT 0;

-- Validation trigger for coverage_mode
CREATE OR REPLACE FUNCTION public.validate_coverage_mode()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.coverage_mode NOT IN ('A', 'B', 'C') THEN
    RAISE EXCEPTION 'Invalid coverage_mode: %. Must be A, B, or C', NEW.coverage_mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_coverage_mode
  BEFORE INSERT OR UPDATE ON public.operator_import_notices
  FOR EACH ROW EXECUTE FUNCTION public.validate_coverage_mode();
