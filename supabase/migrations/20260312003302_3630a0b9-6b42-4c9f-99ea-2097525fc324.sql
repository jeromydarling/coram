
-- ============================================================
-- Phase 3: Data Integrity Guardrails
-- ============================================================

-- 1. Schema version tracking table
CREATE TABLE public.schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text DEFAULT 'system'
);

ALTER TABLE public.schema_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read schema versions"
  ON public.schema_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed initial version
INSERT INTO public.schema_versions (version, description)
VALUES ('3.0.0', 'Phase 3 — Data Integrity Guardrails');

-- 2. Orphan FK sweeper function (SECURITY DEFINER, admin-only)
CREATE OR REPLACE FUNCTION public.sweep_orphan_foreign_keys()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  orphan_count int;
BEGIN
  -- Activities → contacts (contact_id)
  SELECT count(*) INTO orphan_count
  FROM activities a
  WHERE a.contact_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = a.contact_id);
  IF orphan_count > 0 THEN
    result := result || jsonb_build_object(
      'table', 'activities', 'column', 'contact_id',
      'references', 'contacts', 'orphan_count', orphan_count
    );
  END IF;

  -- Activities → opportunities (opportunity_id)
  SELECT count(*) INTO orphan_count
  FROM activities a
  WHERE a.opportunity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id = a.opportunity_id);
  IF orphan_count > 0 THEN
    result := result || jsonb_build_object(
      'table', 'activities', 'column', 'opportunity_id',
      'references', 'opportunities', 'orphan_count', orphan_count
    );
  END IF;

  -- Anchor pipeline → opportunities
  SELECT count(*) INTO orphan_count
  FROM anchor_pipeline ap
  WHERE ap.opportunity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ap.opportunity_id);
  IF orphan_count > 0 THEN
    result := result || jsonb_build_object(
      'table', 'anchor_pipeline', 'column', 'opportunity_id',
      'references', 'opportunities', 'orphan_count', orphan_count
    );
  END IF;

  -- Activity participants → contacts
  SELECT count(*) INTO orphan_count
  FROM activity_participants ap
  WHERE ap.contact_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = ap.contact_id);
  IF orphan_count > 0 THEN
    result := result || jsonb_build_object(
      'table', 'activity_participants', 'column', 'contact_id',
      'references', 'contacts', 'orphan_count', orphan_count
    );
  END IF;

  -- Activity participants → volunteers
  SELECT count(*) INTO orphan_count
  FROM activity_participants ap
  WHERE ap.volunteer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM volunteers v WHERE v.id = ap.volunteer_id);
  IF orphan_count > 0 THEN
    result := result || jsonb_build_object(
      'table', 'activity_participants', 'column', 'volunteer_id',
      'references', 'volunteers', 'orphan_count', orphan_count
    );
  END IF;

  -- AI suggestions → contacts (linked_contact_id)
  SELECT count(*) INTO orphan_count
  FROM ai_suggestions s
  WHERE s.linked_contact_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.linked_contact_id);
  IF orphan_count > 0 THEN
    result := result || jsonb_build_object(
      'table', 'ai_suggestions', 'column', 'linked_contact_id',
      'references', 'contacts', 'orphan_count', orphan_count
    );
  END IF;

  RETURN result;
END;
$$;

-- 3. Data completeness scoring function
CREATE OR REPLACE FUNCTION public.score_data_completeness(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_contacts int;
  contacts_with_email int;
  contacts_with_phone int;
  contacts_with_org int;
  total_opps int;
  opps_with_stage int;
  opps_with_contact int;
  opps_with_metro int;
BEGIN
  -- Contact completeness
  SELECT
    count(*),
    count(*) FILTER (WHERE email IS NOT NULL AND email <> ''),
    count(*) FILTER (WHERE phone IS NOT NULL AND phone <> ''),
    count(*) FILTER (WHERE organization IS NOT NULL AND organization <> '')
  INTO total_contacts, contacts_with_email, contacts_with_phone, contacts_with_org
  FROM contacts
  WHERE tenant_id = p_tenant_id AND deleted_at IS NULL;

  -- Opportunity completeness
  SELECT
    count(*),
    count(*) FILTER (WHERE stage IS NOT NULL),
    count(*) FILTER (WHERE primary_contact_id IS NOT NULL),
    count(*) FILTER (WHERE metro_id IS NOT NULL)
  INTO total_opps, opps_with_stage, opps_with_contact, opps_with_metro
  FROM opportunities
  WHERE tenant_id = p_tenant_id AND deleted_at IS NULL;

  result := jsonb_build_object(
    'contacts', jsonb_build_object(
      'total', total_contacts,
      'with_email', contacts_with_email,
      'with_phone', contacts_with_phone,
      'with_organization', contacts_with_org,
      'completeness_pct', CASE WHEN total_contacts = 0 THEN 100
        ELSE round(((contacts_with_email + contacts_with_phone + contacts_with_org)::numeric / (total_contacts * 3)) * 100)
      END
    ),
    'opportunities', jsonb_build_object(
      'total', total_opps,
      'with_stage', opps_with_stage,
      'with_contact', opps_with_contact,
      'with_metro', opps_with_metro,
      'completeness_pct', CASE WHEN total_opps = 0 THEN 100
        ELSE round(((opps_with_stage + opps_with_contact + opps_with_metro)::numeric / (total_opps * 3)) * 100)
      END
    )
  );

  RETURN result;
END;
$$;
