-- Federation Phase 3 follow-up — Set Transitus ingest URL
--
-- WHAT: Patch the federated_apps registry row for transitus with its now-discovered
--       Supabase URL. This was deferred in 20260428140000_federation_phase_3_add_9_satellites.sql
--       because the project ref was unknown at that time.
-- WHY:  Without an ingest_url, the hub publish-essay function cannot route published
--       essays to transitus. Discovered via Lovable on 2026-04-28: jksfuzmyxgyjsrypxuxp.
-- HOW:  Single UPDATE on federated_apps.

BEGIN;

UPDATE public.federated_apps
   SET ingest_url = 'https://jksfuzmyxgyjsrypxuxp.supabase.co/functions/v1/ingest-essay'
 WHERE source_app = 'transitus';

COMMIT;
