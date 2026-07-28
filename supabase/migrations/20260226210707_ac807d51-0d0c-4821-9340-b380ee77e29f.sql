
-- ═══════════════════════════════════════════════════════
-- IMPACT DIMENSIONS — Tenant-configurable structured metrics
-- ═══════════════════════════════════════════════════════

-- 1) Dimension definitions (tenant-owned)
CREATE TABLE public.impact_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  description text,
  value_type text NOT NULL,
  aggregation_type text NOT NULL,
  is_public_eligible boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT impact_dimensions_tenant_entity_key UNIQUE (tenant_id, entity_type, key)
);

-- Validation trigger for enums
CREATE OR REPLACE FUNCTION public.validate_impact_dimension()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.entity_type NOT IN ('event', 'activity', 'provision') THEN
    RAISE EXCEPTION 'Invalid impact_dimensions entity_type: %', NEW.entity_type;
  END IF;
  IF NEW.value_type NOT IN ('integer', 'decimal', 'currency', 'boolean') THEN
    RAISE EXCEPTION 'Invalid impact_dimensions value_type: %', NEW.value_type;
  END IF;
  IF NEW.aggregation_type NOT IN ('sum', 'avg', 'count', 'max') THEN
    RAISE EXCEPTION 'Invalid impact_dimensions aggregation_type: %', NEW.aggregation_type;
  END IF;
  IF length(NEW.label) > 60 THEN
    RAISE EXCEPTION 'impact_dimensions label exceeds 60 characters';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_impact_dimension
  BEFORE INSERT OR UPDATE ON public.impact_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.validate_impact_dimension();

-- RLS
ALTER TABLE public.impact_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their dimensions"
  ON public.impact_dimensions FOR SELECT
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY "Tenant members can insert dimensions"
  ON public.impact_dimensions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY "Tenant members can update their dimensions"
  ON public.impact_dimensions FOR UPDATE
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY "Tenant members can delete their dimensions"
  ON public.impact_dimensions FOR DELETE
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

-- 2) Dimension values (per-entity)
CREATE TABLE public.impact_dimension_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dimension_id uuid NOT NULL REFERENCES public.impact_dimensions(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  value_numeric numeric,
  value_boolean boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Prevent duplicate values per dimension+entity
CREATE UNIQUE INDEX idx_impact_dim_values_uniq ON public.impact_dimension_values(dimension_id, entity_id);

-- Query indexes
CREATE INDEX idx_impact_dim_values_tenant_entity ON public.impact_dimension_values(tenant_id, entity_id);
CREATE INDEX idx_impact_dim_values_dimension ON public.impact_dimension_values(dimension_id);

-- Validation: ensure correct value column is used
CREATE OR REPLACE FUNCTION public.validate_impact_dimension_value()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_type text;
BEGIN
  SELECT value_type INTO v_type FROM public.impact_dimensions WHERE id = NEW.dimension_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Dimension not found: %', NEW.dimension_id;
  END IF;
  IF v_type IN ('integer', 'decimal', 'currency') AND NEW.value_numeric IS NULL THEN
    RAISE EXCEPTION 'value_numeric required for value_type %', v_type;
  END IF;
  IF v_type = 'boolean' AND NEW.value_boolean IS NULL THEN
    RAISE EXCEPTION 'value_boolean required for value_type boolean';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_impact_dimension_value
  BEFORE INSERT OR UPDATE ON public.impact_dimension_values
  FOR EACH ROW EXECUTE FUNCTION public.validate_impact_dimension_value();

-- RLS
ALTER TABLE public.impact_dimension_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their values"
  ON public.impact_dimension_values FOR SELECT
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY "Tenant members can insert values"
  ON public.impact_dimension_values FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY "Tenant members can update their values"
  ON public.impact_dimension_values FOR UPDATE
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY "Tenant members can delete their values"
  ON public.impact_dimension_values FOR DELETE
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));
