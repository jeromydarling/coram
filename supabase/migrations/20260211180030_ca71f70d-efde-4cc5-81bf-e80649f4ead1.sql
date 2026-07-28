-- Drop overly restrictive unique constraint that prevents versioning
-- The correct constraint (idx_org_knowledge_one_active_per_org) already exists
DROP INDEX IF EXISTS idx_org_knowledge_snapshots_org;
DROP INDEX IF EXISTS idx_org_knowledge_snapshots_ext_key;