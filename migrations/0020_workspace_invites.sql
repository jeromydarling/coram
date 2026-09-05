-- Inviting a second person into a workspace, and knowing whether anyone did.
--
-- Two gaps, closed together because the second cannot be measured without the
-- first existing.
--
-- (1) There was no way to add anyone to a workspace after signup, at all.
-- coram.create_workspace() makes its creator the sole steward and nothing in
-- the product ever adds a second row to `memberships`. A workspace with one
-- steward is a single point of failure for an organization that, by its
-- nature, has high turnover — and today every workspace is that workspace,
-- permanently, because there is no route that changes it. `member.invite`
-- has sat in audit.ts's closed action union since before this file existed,
-- unused, which is the closest this codebase gets to a to-do list.
--
-- (2) `users.last_seen_on` — "date-granular... we need it to expire abandoned
-- accounts" — has never been written by any code path. Its own retention
-- registration sweeps `WHERE last_seen_on < now() - interval`, and a NULL
-- column never satisfies that comparison, so the two-year purge it exists for
-- has been running against zero eligible rows since the table was created.
-- Wiring the write fixes that as a side effect of fixing the first gap,
-- because both are set at the same moment: when someone signs in.
--
-- ---------------------------------------------------------------------------
-- Why invites are a link the steward hands over, not an email Coram sends
-- ---------------------------------------------------------------------------
--
-- Nothing in this codebase sends outbound email yet — the password-reset flow
-- issues a redeemable token and deliberately does not mail it either, because
-- mailing it is Nuntius's job and Nuntius does not exist yet. Building a
-- transactional email pipeline just for this would be a second, larger
-- feature wearing this one's name.
--
-- Handing the raw link back to the steward who just asked for it is not the
-- same compromise reset would be. Reset happens before a session exists,
-- addressed to a possibly-hostile caller who is trying to prove they own an
-- inbox — the whole point is that they cannot be handed the token directly.
-- An invite is created by an authenticated steward who already knows exactly
-- who they mean to hand it to and, for a small organizing group, is more
-- likely to send it over Signal or read it out loud than to trust an email to
-- arrive. This is not a workaround; it is the honest version of "you invite
-- someone" for a tool built for groups that already coordinate this way.
--
-- ---------------------------------------------------------------------------
-- Why there is no accepted_at
-- ---------------------------------------------------------------------------
--
-- An accepted invite has nothing left to do: the relationship it described now
-- lives in `memberships`, which is what every future access decision reads.
-- Keeping the row around after that would be holding a second, redundant copy
-- of someone's email address for no purpose retention.ts would accept as a
-- reason. coram.accept_invite() deletes the row in the same statement that
-- creates the membership, so this table only ever holds invites that are still
-- waiting on someone, and the nightly sweep only ever finds the ones nobody
-- answered.

ALTER TABLE public.memberships ADD COLUMN first_login_on timestamptz;

COMMENT ON COLUMN public.memberships.first_login_on IS
  'Date-granular, like users.last_seen_on, and set once. Answers "did this '
  'person ever actually arrive after joining" per workspace — not last_seen_on, '
  'which is overwritten forward on every login and so cannot tell an activated '
  'workspace apart from one where everyone stopped showing up in month two.';

CREATE TABLE public.workspace_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       coram.role NOT NULL,
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- At most one outstanding invite per address per workspace. Re-inviting
-- someone deletes their old row and inserts a new one rather than updating in
-- place, so this table never needs an UPDATE policy.
CREATE UNIQUE INDEX workspace_invites_pending_email_key
  ON public.workspace_invites (tenant_id, lower(email));

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites FORCE  ROW LEVEL SECURITY;

-- One policy, not select/write split like memberships: an invite is not a
-- roster, and a member's own presence in it is not something they have a
-- reason to read before they have accepted it.
CREATE POLICY workspace_invites_steward ON public.workspace_invites FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

GRANT SELECT, INSERT, DELETE ON public.workspace_invites TO coram_app;
GRANT SELECT, DELETE         ON public.workspace_invites TO coram_cron;

-- ---------------------------------------------------------------------
-- SECURITY DEFINER functions
--
-- Accepting an invite happens before a tenant context exists, the same
-- constraint that puts signup, login and password reset in coram.* rather
-- than behind RLS (see the auth_tokens note above these in 0001).
-- ---------------------------------------------------------------------

-- The tenant name is joined in here, inside the SECURITY DEFINER boundary,
-- specifically so the accept screen can say "You are invited to join
-- <name>" without needing a tenant context of its own just to read one row
-- of `tenants` that RLS would otherwise deny.
CREATE FUNCTION coram.find_invite(_token_hash text)
RETURNS TABLE (id uuid, tenant_id uuid, tenant_name text, email text, role coram.role, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.id, i.tenant_id, t.name, i.email, i.role, i.expires_at
  FROM public.workspace_invites i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token_hash = _token_hash
$$;

-- Single-use by construction: the DELETE only matches a row that still
-- exists and has not expired, so two concurrent redemptions of the same link
-- cannot both succeed — mirrors coram.consume_auth_token's comment in 0001.
-- ON CONFLICT DO NOTHING on the membership insert covers the one case that
-- is not a race: someone already holds a membership here (they were invited
-- again after already joining some other way) and simply keeps the role they
-- had.
CREATE FUNCTION coram.accept_invite(_invite_id uuid, _user_id uuid, _display_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _tenant_id uuid; _role coram.role;
BEGIN
  DELETE FROM public.workspace_invites
  WHERE id = _invite_id AND expires_at > now()
  RETURNING tenant_id, role INTO _tenant_id, _role;

  IF _tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ON CONFLICT rather than a prior check: if this address already holds a
  -- membership here — invited twice, or joined some other way in the
  -- meantime — that membership's existing role wins. A stale invite must not
  -- be able to reach in and change someone's role after the fact.
  INSERT INTO public.memberships (tenant_id, user_id, role, display_name)
  VALUES (_tenant_id, _user_id, _role, _display_name)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN _tenant_id;
END;
$$;

-- Called once per session mint — signup, login, workspace switch, and invite
-- acceptance — which is the only reason either column needs writing.
-- last_seen_on is unconditional; first_login_on only applies to a specific
-- membership and only ever moves from NULL to a date once.
CREATE FUNCTION coram.touch_login(_user_id uuid, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET last_seen_on = CURRENT_DATE
  WHERE id = _user_id AND last_seen_on IS DISTINCT FROM CURRENT_DATE;

  IF _tenant_id IS NOT NULL THEN
    UPDATE public.memberships
    SET first_login_on = CURRENT_DATE
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND first_login_on IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION coram.find_invite(text)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.accept_invite(uuid, uuid, text)       FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.touch_login(uuid, uuid)               FROM PUBLIC;

GRANT EXECUTE ON FUNCTION coram.find_invite(text)                  TO coram_app;
GRANT EXECUTE ON FUNCTION coram.accept_invite(uuid, uuid, text)    TO coram_app;
GRANT EXECUTE ON FUNCTION coram.touch_login(uuid, uuid)            TO coram_app;
