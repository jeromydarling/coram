-- ================================================================
-- Phase 22Ω Canonical Verification Script
-- Run against a live database to confirm all hardening is in place.
-- Every query returns a single row with ok = true when correct.
-- ================================================================

-- 1. Tenants columns exist with correct defaults
SELECT
  bool_and(CASE column_name
    WHEN 'relational_orientation' THEN column_default LIKE '%institution_focused%' AND is_nullable = 'NO'
    WHEN 'people_richness_level' THEN column_default = '1' AND is_nullable = 'NO'
    WHEN 'partner_richness_level' THEN column_default = '3' AND is_nullable = 'NO'
    WHEN 'auto_manage_richness' THEN column_default = 'true' AND is_nullable = 'NO'
    ELSE true
  END) AS ok,
  'tenants_orientation_columns' AS check_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
  AND column_name IN ('relational_orientation','people_richness_level','partner_richness_level','auto_manage_richness');

-- 2. Functions exist: is_tenant_member, set_relational_orientation, has_tenant_role, has_any_tenant_role
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname = 'is_tenant_member') > 0
  AND (SELECT count(*) FROM pg_proc WHERE proname = 'set_relational_orientation') > 0
  AND (SELECT count(*) FROM pg_proc WHERE proname = 'has_tenant_role') > 0
  AND (SELECT count(*) FROM pg_proc WHERE proname = 'has_any_tenant_role') > 0
  AS ok,
  'required_functions_exist' AS check_name;

-- 3. life_events_entity_sync trigger exists and is attached
SELECT
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgrelid = 'public.life_events'::regclass
      AND p.proname = 'life_events_entity_sync'
      AND t.tgenabled = 'O'  -- enabled in origin mode
  ) AS ok,
  'life_events_entity_sync_trigger' AS check_name;

-- 4. life_events CHECK constraints exist
SELECT
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid = 'public.life_events'::regclass
     AND conname = 'chk_entity_type_allowed') = 1
  AND
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid = 'public.life_events'::regclass
     AND conname = 'chk_person_shadow_sync') = 1
  AS ok,
  'life_events_check_constraints' AS check_name;

-- 5. life_events.entity_id is NOT NULL
SELECT
  is_nullable = 'NO' AS ok,
  'life_events_entity_id_not_null' AS check_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'life_events' AND column_name = 'entity_id';

-- 6. RLS enabled on new tables
SELECT
  bool_and(relrowsecurity) AS ok,
  'rls_enabled_new_tables' AS check_name
FROM pg_class
WHERE oid IN (
  'public.entity_richness_overrides'::regclass,
  'public.archive_suggestion_candidates'::regclass,
  'public.archive_reflections'::regclass,
  'public.narrative_influence_events'::regclass,
  'public.tenant_orientation_audit'::regclass
);

-- 7. tenant_orientation_audit table exists
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_orientation_audit'
  ) AS ok,
  'orientation_audit_table_exists' AS check_name;

-- 8. set_relational_orientation is SECURITY DEFINER
SELECT
  prosecdef AS ok,
  'set_relational_orientation_secdef' AS check_name
FROM pg_proc
WHERE proname = 'set_relational_orientation';
