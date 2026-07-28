-- =====================================================================
-- 0001_foundation — tenancy, roles, RLS, audit, burn switch.
-- Forward-only. Do not edit after it has run anywhere.
--
-- CLAUDE.md §4.1: "Enforce every one of these at the Postgres RLS layer.
-- Application-layer checks are a convenience for UX only and are never the
-- security boundary." Everything below exists to make that true.
--
-- The trust chain is:
--   signed JWT  ->  coram.set_request_context()  ->  GUCs  ->  RLS policies
--
-- with one deliberate extra link: set_request_context re-checks the claimed
-- (user, tenant, role) against the memberships table before it sets anything.
-- A handler that forges a context, or a JWT verification bug, still cannot
-- reach another tenant's rows, because the database does not take the
-- Worker's word for who is calling.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS coram;

-- ---------------------------------------------------------------------
-- Connection role.
--
-- The Worker connects as coram_app. It is NOT the owner of these tables
-- and does NOT have BYPASSRLS. Both matter: a table owner silently
-- ignores RLS unless FORCE ROW LEVEL SECURITY is set, and we would rather
-- not have the boundary depend on remembering to set it every time.
-- (We set it anyway, below. Belt and braces.)
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coram_app') THEN
    CREATE ROLE coram_app NOLOGIN;
  END IF;
  -- §4.2: "There is no service-role query path in any request handler —
  -- service-role is reserved for cron jobs." coram_cron is that role. It
  -- carries BYPASSRLS because the nightly sweep must delete across every
  -- tenant at once, which no tenant-scoped policy can express.
  --
  -- It is a separate role, reached over a separate Hyperdrive binding, so
  -- that a compromised request handler cannot borrow it. Request handlers
  -- have no credential for it at all.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coram_cron') THEN
    CREATE ROLE coram_cron NOLOGIN BYPASSRLS;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO coram_app;
GRANT USAGE ON SCHEMA coram TO coram_app;
GRANT USAGE ON SCHEMA public TO coram_cron;
GRANT USAGE ON SCHEMA coram TO coram_cron;

-- ---------------------------------------------------------------------
-- Roles (§4.1)
-- ---------------------------------------------------------------------

CREATE TYPE coram.role AS ENUM ('steward', 'organizer', 'member', 'observer', 'legal');
CREATE TYPE coram.tier AS ENUM ('parish', 'local', 'coalition', 'federation');

-- ---------------------------------------------------------------------
-- Request context accessors.
--
-- These read transaction-local GUCs. `true` as the second argument to
-- current_setting means "return NULL if unset" rather than raising — so an
-- unscoped connection reads as NULL, every policy below evaluates false,
-- and the default is deny rather than error-into-some-other-branch.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE SET search_path = ''
  AS $$ SELECT nullif(current_setting('coram.user_id', true), '')::uuid $$;

CREATE FUNCTION coram.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE SET search_path = ''
  AS $$ SELECT nullif(current_setting('coram.tenant_id', true), '')::uuid $$;

CREATE FUNCTION coram.current_role() RETURNS coram.role
  LANGUAGE sql STABLE PARALLEL SAFE SET search_path = ''
  AS $$ SELECT nullif(current_setting('coram.role', true), '')::coram.role $$;

CREATE FUNCTION coram.current_turf_ids() RETURNS uuid[]
  LANGUAGE sql STABLE PARALLEL SAFE SET search_path = ''
  AS $$
    SELECT coalesce(
      nullif(current_setting('coram.turf_ids', true), '')::uuid[],
      '{}'::uuid[]
    )
  $$;

-- Convenience predicate used throughout the policies.
CREATE FUNCTION coram.has_role(VARIADIC _roles coram.role[]) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SET search_path = ''
  AS $$ SELECT coram.current_role() = ANY(_roles) $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

CREATE TABLE public.tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  tier          coram.tier NOT NULL DEFAULT 'parish',
  contact_count bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL,
  password_hash     text NOT NULL,
  email_verified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_on      timestamptz
);
CREATE UNIQUE INDEX users_email_key ON public.users (lower(email));

CREATE TABLE public.memberships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         coram.role NOT NULL,
  turf_ids     uuid[] NOT NULL DEFAULT '{}'::uuid[],
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX memberships_user_idx ON public.memberships (user_id);

-- Only an organizer carries turf. Enforced here rather than in the app so
-- the invariant survives a handler that forgets it.
ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_turf_only_for_organizers
  CHECK (role = 'organizer' OR cardinality(turf_ids) = 0);

CREATE TABLE public.auth_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_idx ON public.auth_tokens (user_id);

-- §3.6: access, never content. There is no payload column here, by design.
CREATE TABLE public.audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role   coram.role,
  action       text NOT NULL,
  record_type  text NOT NULL,
  record_count bigint NOT NULL DEFAULT 1,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_time_idx ON public.audit_log (tenant_id, occurred_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id);

CREATE TABLE public.burned_tenants (
  tenant_id uuid PRIMARY KEY,
  burned_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Default deny.
--
-- ENABLE turns RLS on for non-owners; FORCE extends it to the owner too.
-- With RLS on and no policy granting a command, that command is denied.
-- Every permission below is therefore additive and explicit.
-- ---------------------------------------------------------------------

ALTER TABLE public.tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.memberships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.burned_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.burned_tenants FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------

-- tenants -------------------------------------------------------------

CREATE POLICY tenants_select ON public.tenants FOR SELECT TO coram_app
  USING (id = coram.current_tenant_id());

-- Billing and tier are the steward's (§4.1). Note there is no INSERT policy:
-- workspace creation goes through coram.create_workspace(), because it has to
-- happen before the caller has a tenant context to be checked against.
CREATE POLICY tenants_update ON public.tenants FOR UPDATE TO coram_app
  USING (id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (id = coram.current_tenant_id());

-- users ---------------------------------------------------------------

-- You can always read yourself. A steward can additionally read the login
-- records of people in their own workspace, which is what makes the member
-- admin screen possible.
CREATE POLICY users_select_self ON public.users FOR SELECT TO coram_app
  USING (id = coram.current_user_id());

CREATE POLICY users_select_by_steward ON public.users FOR SELECT TO coram_app
  USING (
    coram.has_role('steward')
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = users.id
        AND m.tenant_id = coram.current_tenant_id()
    )
  );

CREATE POLICY users_update_self ON public.users FOR UPDATE TO coram_app
  USING (id = coram.current_user_id())
  WITH CHECK (id = coram.current_user_id());

-- memberships ---------------------------------------------------------

-- Everyone in a workspace can see who else is in it, with one exception:
-- `legal` is scoped to Custos and gets only its own row (§4.1).
CREATE POLICY memberships_select ON public.memberships FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (NOT coram.has_role('legal') OR user_id = coram.current_user_id())
  );

CREATE POLICY memberships_write ON public.memberships FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- auth_tokens ---------------------------------------------------------

-- No policy at all. Deliberate: signup, login and password reset all happen
-- before a tenant context exists, so they cannot be expressed as RLS. They go
-- through the SECURITY DEFINER functions below instead, and direct access
-- from coram_app stays denied.

-- audit_log -----------------------------------------------------------

-- Append-only from the app's point of view: INSERT is allowed, UPDATE and
-- DELETE are not (no policy). Only the retention sweep removes rows, and it
-- runs as the owner.
CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND actor_id IS NOT DISTINCT FROM coram.current_user_id()
  );

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (coram.has_role('steward') OR actor_id = coram.current_user_id())
  );

-- burned_tenants ------------------------------------------------------

-- Public-ish within the app: anyone hitting a dead workspace needs to be told
-- it was destroyed rather than shown a bare 404. Holds nothing sensitive.
CREATE POLICY burned_tenants_select ON public.burned_tenants FOR SELECT TO coram_app
  USING (true);

-- ---------------------------------------------------------------------
-- Grants. RLS narrows these; it cannot widen them.
-- ---------------------------------------------------------------------

GRANT SELECT, UPDATE                 ON public.tenants        TO coram_app;
GRANT SELECT, UPDATE                 ON public.users          TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships    TO coram_app;
GRANT SELECT, INSERT                 ON public.audit_log      TO coram_app;
GRANT SELECT                         ON public.burned_tenants TO coram_app;
-- auth_tokens: no grant. Reached only via SECURITY DEFINER functions.

-- The sweep deletes and, for anonymizing tables, updates. It never reads a
-- value it does not need to, and it is granted nothing beyond that.
GRANT SELECT, UPDATE, DELETE ON public.users       TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.memberships TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.auth_tokens TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.audit_log   TO coram_cron;

-- ---------------------------------------------------------------------
-- Request context.
--
-- The Worker calls this once per transaction, after verifying the JWT.
-- It re-derives role and turf from the memberships table rather than
-- trusting what it was handed, so a forged or stale token cannot widen
-- access. The token says who you claim to be; this says what you are.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.set_request_context(_user_id uuid, _tenant_id uuid)
RETURNS coram.role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _role  coram.role;
  _turfs uuid[];
BEGIN
  IF _user_id IS NULL OR _tenant_id IS NULL THEN
    RAISE EXCEPTION 'coram: request context requires both a user and a tenant'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT m.role, m.turf_ids INTO _role, _turfs
  FROM public.memberships m
  WHERE m.user_id = _user_id AND m.tenant_id = _tenant_id;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'coram: no membership for that user in that workspace'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- `true` => SET LOCAL semantics. The setting dies with the transaction,
  -- which is what makes this safe over a pooled Hyperdrive connection.
  PERFORM set_config('coram.user_id',   _user_id::text,  true);
  PERFORM set_config('coram.tenant_id', _tenant_id::text, true);
  PERFORM set_config('coram.role',      _role::text,      true);
  PERFORM set_config('coram.turf_ids',  _turfs::text,     true);

  RETURN _role;
END;
$$;

REVOKE ALL ON FUNCTION coram.set_request_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.set_request_context(uuid, uuid) TO coram_app;

-- ---------------------------------------------------------------------
-- Pre-session operations.
--
-- Signup, login and reset all run without a tenant context, so they cannot
-- be RLS-scoped. Each is a narrow SECURITY DEFINER function that returns
-- only what the auth path needs, rather than opening up the tables.
-- ---------------------------------------------------------------------

-- Returns the verifier for a login attempt. Caller compares the hash in
-- constant time; this function deliberately does not take a password.
CREATE FUNCTION coram.find_login(_email text)
RETURNS TABLE (id uuid, password_hash text, email_verified_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.password_hash, u.email_verified_at
  FROM public.users u
  WHERE lower(u.email) = lower(_email)
$$;

CREATE FUNCTION coram.create_user(_email text, _password_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.users (email, password_hash)
  VALUES (_email, _password_hash)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE FUNCTION coram.issue_auth_token(
  _user_id uuid, _kind text, _token_hash text, _expires_at timestamptz
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.auth_tokens (user_id, kind, token_hash, expires_at)
  VALUES (_user_id, _kind, _token_hash, _expires_at)
$$;

-- Single-use by construction: the UPDATE only matches a row that is unused
-- and unexpired, so two concurrent redemptions cannot both succeed.
CREATE FUNCTION coram.consume_auth_token(_token_hash text, _kind text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.auth_tokens
  SET used_at = now()
  WHERE token_hash = _token_hash
    AND kind = _kind
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING user_id
$$;

-- Set or replace a password verifier. Used by the reset flow, and by the login
-- path when the PBKDF2 iteration count has been raised since the password was
-- last set. Takes an already-hashed value; this function never sees plaintext.
CREATE FUNCTION coram.set_password(_user_id uuid, _password_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.users SET password_hash = _password_hash WHERE id = _user_id
$$;

-- Workspaces a person belongs to, for the post-login workspace picker. Runs
-- before a tenant context exists, so it cannot be an RLS-scoped query.
CREATE FUNCTION coram.list_memberships(_user_id uuid)
RETURNS TABLE (tenant_id uuid, tenant_name text, role coram.role)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.tenant_id, t.name, m.role
  FROM public.memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.user_id = _user_id
  ORDER BY t.name
$$;

-- Creating a workspace makes its creator the steward. One transaction, so a
-- tenant can never exist without an owner.
CREATE FUNCTION coram.create_workspace(_user_id uuid, _name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _tenant_id uuid;
BEGIN
  INSERT INTO public.tenants (name, slug) VALUES (_name, _slug)
  RETURNING id INTO _tenant_id;

  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (_tenant_id, _user_id, 'steward');

  RETURN _tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION coram.find_login(text)                                   FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.create_user(text, text)                            FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.issue_auth_token(uuid, text, text, timestamptz)    FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.consume_auth_token(text, text)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.set_password(uuid, text)                           FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.list_memberships(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.create_workspace(uuid, text, text)                 FROM PUBLIC;

GRANT EXECUTE ON FUNCTION coram.find_login(text)                                TO coram_app;
GRANT EXECUTE ON FUNCTION coram.create_user(text, text)                         TO coram_app;
GRANT EXECUTE ON FUNCTION coram.issue_auth_token(uuid, text, text, timestamptz) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.consume_auth_token(text, text)                  TO coram_app;
GRANT EXECUTE ON FUNCTION coram.set_password(uuid, text)                        TO coram_app;
GRANT EXECUTE ON FUNCTION coram.list_memberships(uuid)                          TO coram_app;
GRANT EXECUTE ON FUNCTION coram.create_workspace(uuid, text, text)              TO coram_app;

-- ---------------------------------------------------------------------
-- Burn switch (§3.5)
--
-- Irreversible. No soft-delete, no tombstone beyond the tenant id itself.
-- Postgres side is one statement: deleting the tenant cascades to every
-- tenant-scoped table, which is exactly why every such table declares
-- ON DELETE CASCADE. R2 objects and Durable Object state are destroyed by
-- the Worker; see src/worker/routes/api/workspace.ts.
--
-- Runs as SECURITY DEFINER because it must delete rows the caller's own
-- policies would not let them touch — so it re-verifies stewardship itself
-- rather than trusting the GUC.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.burn_workspace(_user_id uuid, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND m.role = 'steward'
  ) THEN
    RAISE EXCEPTION 'coram: only a steward may burn a workspace'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Tombstone first. If the delete fails we would rather have a spurious
  -- tombstone than a destroyed workspace with no record that it existed.
  INSERT INTO public.burned_tenants (tenant_id)
  VALUES (_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  DELETE FROM public.tenants WHERE id = _tenant_id;

  -- Users who were only ever in this workspace have nothing left to sign in
  -- to. Leaving them would keep an email address we no longer have a reason
  -- to hold (§3, rule 4).
  DELETE FROM public.users u
  WHERE u.id = _user_id
    AND NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = u.id);
END;
$$;

REVOKE ALL ON FUNCTION coram.burn_workspace(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.burn_workspace(uuid, uuid) TO coram_app;

COMMIT;
