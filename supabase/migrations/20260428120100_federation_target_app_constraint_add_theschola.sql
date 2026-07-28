-- Federation Phase 2: extend library_essays.target_app whitelist to include 'theschola'
--
-- The original Phase 2 hub migration (20260428114500_federation_phase_2_publishing_hub.sql)
-- hardcoded the target_app CHECK constraint to the original 7 federated apps.
-- Schola was added to federated_apps via 20260428120000_federation_app_registry_add_theschola.sql
-- but the CHECK constraint was not updated, which would block any
-- INSERT/UPDATE on library_essays with target_app='theschola'.
--
-- This migration drops and recreates the constraint with 'theschola' included.

ALTER TABLE library_essays
  DROP CONSTRAINT IF EXISTS library_essays_target_app_chk;

ALTER TABLE library_essays
  ADD CONSTRAINT library_essays_target_app_chk
  CHECK (target_app IN (
    'thecros',
    'vigilia',
    'resurrectio',
    'hortus',
    'communis',
    'transitus',
    'bitoku',
    'theschola'
  ));
