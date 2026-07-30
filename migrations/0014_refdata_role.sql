-- ---------------------------------------------------------------------
-- 0014 — A role for the reference-data sync, and nothing else
--
-- Correcting a mistake in the workflow added with 0013. That workflow asked for
-- an owner-role connection string as a GitHub Actions secret, because the
-- ref_* tables grant SELECT to coram_app and write to nobody else.
--
-- `neondb_owner` has BYPASSRLS and owns every table in the database. Handing it
-- to CI would mean any workflow, any action, and anyone who can push to a
-- workflow file could read every workspace's contacts with row-level security
-- bypassed entirely. For a product whose argument is that it holds as little as
-- possible and cannot see what it does not need, that is the wrong credential
-- to leave lying in a secret store.
--
-- So the sync gets its own role whose entire authority is the four reference
-- tables. If the secret leaks, what leaks with it is a published roster of who
-- currently holds public office — data anyone can download from Open States and
-- the Library of Congress without asking us.
--
-- ---------------------------------------------------------------------
-- What this role deliberately cannot do
-- ---------------------------------------------------------------------
--
--   * No BYPASSRLS. It could not read a tenant's rows even if it were granted
--     the table, which it is not.
--   * No grant on any public.* table other than the four ref_* ones. Not
--     contacts, not bills, not the audit log.
--   * No CREATE on the schema, so it cannot add a table and cannot alter one.
--   * No password here. `CREATE ROLE ... LOGIN` with no password cannot
--     authenticate, so applying this migration grants nobody anything until an
--     operator sets a password deliberately. See docs/deploy.md.
--
-- The tables it writes are replaced wholesale on every run, so it needs DELETE
-- as well as INSERT and UPDATE. It does not need TRUNCATE, and TRUNCATE on a
-- table another role's foreign keys point at is a bigger hammer than this job
-- has any use for.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coram_refdata') THEN
    -- LOGIN but no password: unusable until an operator sets one.
    CREATE ROLE coram_refdata LOGIN;
  END IF;
END
$$;

-- Neon requires new roles to be members of neon_superuser to be manageable from
-- the console, but that would hand back everything this migration removes. It is
-- deliberately NOT granted: this role is managed by SQL, not by the dashboard.

GRANT CONNECT ON DATABASE neondb TO coram_refdata;
GRANT USAGE ON SCHEMA public TO coram_refdata;

-- Exactly four tables, named one at a time. `ALL TABLES IN SCHEMA` would have
-- granted write on every tenant table in the product, which is the mistake this
-- migration exists to correct — and it would silently grant on tables added
-- later, which is worse.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_sync              TO coram_refdata;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_legislators       TO coram_refdata;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_committees        TO coram_refdata;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_committee_members TO coram_refdata;

-- No sequences to grant: every ref_* key is a natural text id from upstream.

/*
 * Belt and braces against a Postgres default that surprises people.
 *
 * Everything created in `public` is granted to the PUBLIC pseudo-role in some
 * configurations, which would make the careful list above decorative. Revoking
 * from PUBLIC is a no-op where it was never granted and closes the hole where it
 * was. The regression test for this is a query in docs/deploy.md that asserts
 * coram_refdata holds privileges on exactly four tables.
 */
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_sync              TO coram_refdata;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_legislators       TO coram_refdata;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_committees        TO coram_refdata;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_committee_members TO coram_refdata;
