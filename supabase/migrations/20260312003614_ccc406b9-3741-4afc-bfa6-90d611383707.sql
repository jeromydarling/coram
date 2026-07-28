
-- ============================================================
-- Phase 4: Feature Completeness
-- ============================================================

-- 1. Saved filter views (per-user persistent filters)
CREATE TABLE public.saved_filter_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  view_name text NOT NULL,
  entity_type text NOT NULL, -- 'contacts', 'opportunities', 'activities', etc.
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_config jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sfv_user_entity ON public.saved_filter_views (user_id, entity_type);
CREATE UNIQUE INDEX idx_sfv_user_default ON public.saved_filter_views (user_id, entity_type) WHERE is_default = true;

ALTER TABLE public.saved_filter_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own filter views"
  ON public.saved_filter_views FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Duplicate detection function (fuzzy match on contacts)
CREATE OR REPLACE FUNCTION public.detect_duplicate_contacts(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  rec record;
BEGIN
  -- Email duplicates (exact match, case-insensitive)
  FOR rec IN
    SELECT lower(email) AS match_value, 'email' AS match_type,
           array_agg(id ORDER BY created_at) AS contact_ids,
           array_agg(
             coalesce(first_name, '') || ' ' || coalesce(last_name, '')
             ORDER BY created_at
           ) AS names,
           count(*) AS count
    FROM contacts
    WHERE tenant_id = p_tenant_id
      AND deleted_at IS NULL
      AND email IS NOT NULL AND email <> ''
    GROUP BY lower(email)
    HAVING count(*) > 1
    LIMIT 50
  LOOP
    result := result || jsonb_build_object(
      'match_type', rec.match_type,
      'match_value', rec.match_value,
      'contact_ids', to_jsonb(rec.contact_ids),
      'names', to_jsonb(rec.names),
      'count', rec.count
    );
  END LOOP;

  -- Name duplicates (exact first+last, case-insensitive)
  FOR rec IN
    SELECT lower(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) AS match_value,
           'name' AS match_type,
           array_agg(id ORDER BY created_at) AS contact_ids,
           array_agg(coalesce(email, '') ORDER BY created_at) AS emails,
           count(*) AS count
    FROM contacts
    WHERE tenant_id = p_tenant_id
      AND deleted_at IS NULL
      AND first_name IS NOT NULL AND first_name <> ''
      AND last_name IS NOT NULL AND last_name <> ''
    GROUP BY lower(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
    HAVING count(*) > 1
    LIMIT 50
  LOOP
    result := result || jsonb_build_object(
      'match_type', rec.match_type,
      'match_value', rec.match_value,
      'contact_ids', to_jsonb(rec.contact_ids),
      'emails', to_jsonb(rec.emails),
      'count', rec.count
    );
  END LOOP;

  RETURN result;
END;
$$;

-- 3. Bulk soft-delete function (idempotent)
CREATE OR REPLACE FUNCTION public.bulk_soft_delete(
  p_table text,
  p_ids uuid[],
  p_user_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
BEGIN
  -- Only allow known tables
  IF p_table NOT IN ('contacts', 'opportunities', 'activities', 'volunteers') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unsupported table: ' || p_table);
  END IF;

  -- Verify tenant membership
  IF NOT is_tenant_member(p_tenant_id, p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this tenant');
  END IF;

  -- Execute soft delete
  EXECUTE format(
    'UPDATE %I SET deleted_at = now() WHERE id = ANY($1) AND tenant_id = $2 AND deleted_at IS NULL',
    p_table
  ) USING p_ids, p_tenant_id;

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Audit log entries
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, entity_name, changes)
  SELECT p_user_id, 'bulk_delete', p_table, unnest(p_ids), 'bulk operation',
         jsonb_build_object('bulk', true, 'count', array_length(p_ids, 1));

  RETURN jsonb_build_object('ok', true, 'affected', affected);
END;
$$;

-- 4. Bulk field update function
CREATE OR REPLACE FUNCTION public.bulk_update_field(
  p_table text,
  p_ids uuid[],
  p_field text,
  p_value text,
  p_user_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
  allowed_fields text[];
BEGIN
  -- Only allow known tables
  IF p_table NOT IN ('contacts', 'opportunities') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unsupported table');
  END IF;

  -- Allowlist fields per table
  IF p_table = 'contacts' THEN
    allowed_fields := ARRAY['organization', 'title', 'city', 'state'];
  ELSIF p_table = 'opportunities' THEN
    allowed_fields := ARRAY['stage', 'metro_id', 'owner_id'];
  END IF;

  IF NOT (p_field = ANY(allowed_fields)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Field not allowed: ' || p_field);
  END IF;

  -- Verify tenant membership
  IF NOT is_tenant_member(p_tenant_id, p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this tenant');
  END IF;

  EXECUTE format(
    'UPDATE %I SET %I = $1, updated_at = now() WHERE id = ANY($2) AND tenant_id = $3 AND deleted_at IS NULL',
    p_table, p_field
  ) USING p_value, p_ids, p_tenant_id;

  GET DIAGNOSTICS affected = ROW_COUNT;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, entity_name, changes)
  SELECT p_user_id, 'bulk_update', p_table, unnest(p_ids), 'bulk operation',
         jsonb_build_object('field', p_field, 'value', p_value, 'count', array_length(p_ids, 1));

  RETURN jsonb_build_object('ok', true, 'affected', affected);
END;
$$;

-- Update schema version
INSERT INTO public.schema_versions (version, description)
VALUES ('4.0.0', 'Phase 4 — Feature Completeness: saved filters, bulk ops, duplicate detection');
