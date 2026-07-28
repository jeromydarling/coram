-- =====================================================================
-- 0007_consilium — governance (§5.8).
-- Forward-only. Do not edit after it has run anywhere.
--
-- "The module no competitor ships. This is the moat."
--
-- The whole migration turns on one structural decision: for a secret ballot,
-- there is no column anywhere that joins a voter to a choice. Not a nullable
-- one, not an encrypted one, not one behind a policy. Three tables that do not
-- reference each other:
--
--   ballot_enrollments   member was eligible and has a token   (no token)
--   ballot_tokens        this token hash is valid              (no voter)
--   votes                this token chose that                 (no voter)
--
-- Tokens are inserted shuffled, in one transaction at ballot open, with no
-- per-row timestamp — so neither insertion order nor timing reconstructs the
-- link that the schema refuses to store.
--
-- docs/ballot-secrecy.md states precisely what this guarantees and the one
-- thing it does not. Read it before changing anything below.
-- =====================================================================

BEGIN;

CREATE TYPE coram.voting_method AS ENUM (
  'consensus',           -- blocks matter; any block prevents adoption
  'modified_consensus',  -- blocks matter, but a supermajority can override
  'simple_majority',
  'supermajority',
  'ranked_choice'
);

CREATE TYPE coram.vote_choice AS ENUM ('yes', 'no', 'abstain', 'block', 'stand_aside');

-- ---------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------

CREATE TABLE public.proposals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  title      text NOT NULL,
  body       text NOT NULL,

  status     text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'discussion', 'voting', 'adopted', 'rejected', 'withdrawn')),

  proposed_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz
);

CREATE INDEX proposals_tenant_idx ON public.proposals (tenant_id, created_at DESC);

-- Threaded discussion. parent_id makes it a tree; depth is not limited in the
-- schema because a governance argument nests as deep as it nests.
CREATE TABLE public.proposal_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.proposal_comments(id) ON DELETE CASCADE,

  author_id   uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  body        text NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Editing is allowed but visible. A discussion where someone can silently
  -- rewrite what they said is not a record of a deliberation.
  edited_at   timestamptz
);

CREATE INDEX proposal_comments_proposal_idx ON public.proposal_comments (proposal_id, created_at);

-- Amendments tracked as their own objects rather than as edits to the proposal
-- body, so what was actually voted on stays legible after the fact.
CREATE TABLE public.amendments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,

  body        text NOT NULL,
  rationale   text,

  status      text NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed', 'accepted', 'rejected', 'withdrawn')),

  proposed_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz
);

CREATE INDEX amendments_proposal_idx ON public.amendments (proposal_id);

-- ---------------------------------------------------------------------
-- Ballots
-- ---------------------------------------------------------------------

CREATE TABLE public.ballots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,

  method      coram.voting_method NOT NULL,

  /*
   * Secret or recorded, and this is a governance choice rather than a security
   * setting. A recorded ballot attributes votes on purpose — a delegate body
   * whose members are entitled to know how their delegate voted. See
   * docs/ballot-secrecy.md.
   */
  is_secret   boolean NOT NULL DEFAULT true,

  -- Quorum, as a fraction of the eligible roll. Configurable per ballot
  -- because bylaws differ and hardcoding "half plus one" would make the module
  -- useless to half its users.
  quorum_numerator   integer NOT NULL DEFAULT 1 CHECK (quorum_numerator > 0),
  quorum_denominator integer NOT NULL DEFAULT 2 CHECK (quorum_denominator > 0),

  -- The bar to pass, same shape. 2/3 for a supermajority, 1/2 for simple.
  threshold_numerator   integer NOT NULL DEFAULT 1 CHECK (threshold_numerator > 0),
  threshold_denominator integer NOT NULL DEFAULT 2 CHECK (threshold_denominator > 0),

  -- Ranked choice options, in order of presentation. Empty for yes/no methods.
  options     jsonb NOT NULL DEFAULT '[]'::jsonb,

  opens_at    timestamptz NOT NULL DEFAULT now(),
  closes_at   timestamptz NOT NULL,

  -- Frozen at open. Quorum measured against a roll that changes mid-vote is
  -- not a quorum.
  eligible_count integer,

  closed_at   timestamptz,
  result      text CHECK (result IN ('adopted', 'rejected', 'no_quorum', 'blocked')),

  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ballots_closes_after_opens CHECK (closes_at > opens_at)
);

CREATE INDEX ballots_proposal_idx ON public.ballots (proposal_id);

-- ---------------------------------------------------------------------
-- The three unlinked tables
-- ---------------------------------------------------------------------

-- Who was eligible, and that they hold a token. No token column, deliberately.
CREATE TABLE public.ballot_enrollments (
  ballot_id     uuid NOT NULL REFERENCES public.ballots(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Whether this member's token has been handed over yet. Not when: a precise
  -- collection time would correlate with a vote's arrival time.
  collected     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (ballot_id, membership_id)
);

-- Valid tokens. No voter column, deliberately, and no issued_at — a timestamp
-- here would correlate with ballot_enrollments and undo the separation.
CREATE TABLE public.ballot_tokens (
  ballot_id  uuid NOT NULL REFERENCES public.ballots(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  spent_at   timestamptz,
  PRIMARY KEY (ballot_id, token_hash)
);

CREATE INDEX ballot_tokens_unspent_idx ON public.ballot_tokens (ballot_id)
  WHERE spent_at IS NULL;

-- A vote. For a secret ballot the voter is a token hash and nothing else. For
-- a recorded ballot the membership is set on purpose and the token is null.
--
-- The CHECK is the load-bearing line in this migration: exactly one of the two
-- is present, so a secret ballot physically cannot acquire an attributed vote,
-- even by a bug in a handler.
CREATE TABLE public.votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id  uuid NOT NULL REFERENCES public.ballots(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  token_hash    text,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE CASCADE,

  choice     coram.vote_choice,
  -- Ranked choice: an ordered array of option indices.
  rankings   jsonb,

  /*
   * Deliberately coarse. A precise timestamp on a secret vote plus a precise
   * timestamp anywhere else — a session log, a page view — narrows who cast it,
   * and on a small committee that is enough to identify someone. Rounded to
   * the hour, which is plenty for ordering and useless for correlation.
   */
  cast_hour  timestamptz NOT NULL DEFAULT date_trunc('hour', now()),

  CONSTRAINT votes_secret_xor_recorded CHECK (
    (token_hash IS NOT NULL AND membership_id IS NULL)
    OR (token_hash IS NULL AND membership_id IS NOT NULL)
  ),
  CONSTRAINT votes_choice_or_rankings CHECK (
    (choice IS NOT NULL AND rankings IS NULL)
    OR (choice IS NULL AND rankings IS NOT NULL)
  )
);

-- One vote per token, one vote per member. Partial uniques so each applies
-- only to the ballot kind it belongs to.
CREATE UNIQUE INDEX votes_token_key ON public.votes (ballot_id, token_hash)
  WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX votes_membership_key ON public.votes (ballot_id, membership_id)
  WHERE membership_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Proxies (§5.8)
-- ---------------------------------------------------------------------

CREATE TABLE public.proxies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  grantor_id  uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  grantee_id  uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,

  -- Null scope means every ballot until revoked. A specific ballot is the
  -- narrower and better-behaved case.
  ballot_id   uuid REFERENCES public.ballots(id) ON DELETE CASCADE,

  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,

  CONSTRAINT proxies_no_self CHECK (grantor_id <> grantee_id)
);

CREATE UNIQUE INDEX proxies_active_key
  ON public.proxies (grantor_id, coalesce(ballot_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revoked_at IS NULL;

CREATE INDEX proxies_grantee_idx ON public.proxies (grantee_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- Bylaws vault with version history, and minutes (§5.8)
-- ---------------------------------------------------------------------

CREATE TABLE public.bylaws (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, title)
);

-- Append-only. A bylaw's history is the point of keeping it here rather than
-- in a shared document, so a version is never edited or removed.
CREATE TABLE public.bylaw_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bylaw_id   uuid NOT NULL REFERENCES public.bylaws(id) ON DELETE CASCADE,

  version    integer NOT NULL,
  body       text NOT NULL,
  -- The proposal that adopted this version, when there was one.
  adopted_by_proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  UNIQUE (bylaw_id, version)
);

CREATE TABLE public.minutes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Null for a standalone meeting; set when minutes cover one decision.
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,

  title       text NOT NULL,
  body        text NOT NULL,
  met_on      date NOT NULL,

  -- Generated minutes start as a draft and a human adopts them. §5.8 asks for
  -- automatic generation, not automatic authority.
  adopted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX minutes_tenant_idx ON public.minutes (tenant_id, met_on DESC);

-- ---------------------------------------------------------------------
-- Eligibility (§5.8: "Dues status and member standing, feeding eligibility")
--
-- A member in good standing is one with a membership, whose dues are not
-- lapsed. A hardship waiver counts as good standing — that is the entire point
-- of a hardship waiver, and a governance module that disenfranchised the
-- members who most need the group would be worse than one with no dues
-- integration at all.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.is_in_good_standing(_membership_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    LEFT JOIN public.contacts c ON c.user_id = m.user_id AND c.tenant_id = m.tenant_id
    LEFT JOIN public.dues_schedules d ON d.contact_id = c.id
    WHERE m.id = _membership_id
      -- `legal` is scoped to Custos and is not a member of the body.
      AND m.role <> 'legal'
      AND (
        d.id IS NULL                    -- no dues configured: everyone votes
        OR d.hardship_waiver            -- waived, and still in good standing
        OR d.status = 'active'
      )
  )
$$;

/*
 * Open a ballot: freeze the roll, enrol everyone eligible, and mint one token
 * per enrolment.
 *
 * The tokens arrive already hashed, generated by the Worker, and are inserted
 * in the order given — the caller shuffles before sending. All of it happens in
 * one transaction at open, before any vote is cast, so nothing about the order
 * or timing of these rows says who holds which token.
 */
CREATE FUNCTION coram.open_ballot(_ballot_id uuid, _token_hashes text[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tenant   uuid := coram.current_tenant_id();
  _eligible uuid[];
  _count    integer;
BEGIN
  IF NOT coram.has_role('steward') THEN
    RAISE EXCEPTION 'coram: only a steward may open a ballot'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ballot_enrollments WHERE ballot_id = _ballot_id) THEN
    RAISE EXCEPTION 'coram: that ballot is already open' USING ERRCODE = 'check_violation';
  END IF;

  SELECT array_agg(m.id) INTO _eligible
  FROM public.memberships m
  WHERE m.tenant_id = _tenant AND coram.is_in_good_standing(m.id);

  _count := coalesce(array_length(_eligible, 1), 0);

  IF _count = 0 THEN
    RAISE EXCEPTION 'coram: nobody is eligible to vote' USING ERRCODE = 'check_violation';
  END IF;
  IF array_length(_token_hashes, 1) <> _count THEN
    RAISE EXCEPTION 'coram: got % tokens for % eligible members',
      coalesce(array_length(_token_hashes, 1), 0), _count USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.ballot_enrollments (ballot_id, membership_id, tenant_id)
  SELECT _ballot_id, unnest(_eligible), _tenant;

  INSERT INTO public.ballot_tokens (ballot_id, tenant_id, token_hash)
  SELECT _ballot_id, _tenant, unnest(_token_hashes);

  UPDATE public.ballots
  SET eligible_count = _count, opens_at = now()
  WHERE id = _ballot_id AND tenant_id = _tenant;

  RETURN _count;
END;
$$;

/*
 * Cast a secret vote.
 *
 * Takes a token hash and never a voter. The row lock on the token is what makes
 * one-vote-each true under concurrency: two simultaneous submissions of the same
 * token serialize, and the second finds it spent.
 *
 * Note there is no parameter for who is voting. Not an optional one — none. A
 * function that cannot receive the voter's identity cannot record it.
 */
CREATE FUNCTION coram.cast_secret_vote(
  _ballot_id uuid, _token_hash text, _choice coram.vote_choice, _rankings jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tenant uuid;
  _spent  timestamptz;
  _closes timestamptz;
BEGIN
  SELECT b.tenant_id, b.closes_at INTO _tenant, _closes
  FROM public.ballots b WHERE b.id = _ballot_id AND b.closed_at IS NULL;

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'coram: that ballot is not open' USING ERRCODE = 'no_data_found';
  END IF;
  IF now() > _closes THEN
    RAISE EXCEPTION 'coram: voting has closed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT t.spent_at INTO _spent
  FROM public.ballot_tokens t
  WHERE t.ballot_id = _ballot_id AND t.token_hash = _token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coram: that is not a valid ballot token' USING ERRCODE = 'no_data_found';
  END IF;
  IF _spent IS NOT NULL THEN
    RAISE EXCEPTION 'coram: that token has already been used' USING ERRCODE = 'unique_violation';
  END IF;

  UPDATE public.ballot_tokens SET spent_at = now()
  WHERE ballot_id = _ballot_id AND token_hash = _token_hash;

  INSERT INTO public.votes (ballot_id, tenant_id, token_hash, choice, rankings)
  VALUES (_ballot_id, _tenant, _token_hash, _choice, _rankings);
END;
$$;

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.proposal_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_comments  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.amendments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amendments         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ballots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ballots            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ballot_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ballot_enrollments FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ballot_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ballot_tokens      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.votes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes              FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.proxies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proxies            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.bylaws             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bylaws             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.bylaw_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bylaw_versions     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.minutes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minutes            FORCE  ROW LEVEL SECURITY;

-- Governance is the members' business. Everyone in the workspace reads it
-- except `legal`, who is scoped to Custos.
CREATE POLICY proposals_select ON public.proposals FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY proposals_write ON public.proposals FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer', 'member'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer', 'member'));

CREATE POLICY comments_select ON public.proposal_comments FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY comments_insert ON public.proposal_comments FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND NOT coram.has_role('legal', 'observer')
    AND author_id = (SELECT m.id FROM public.memberships m
                     WHERE m.user_id = coram.current_user_id()
                       AND m.tenant_id = coram.current_tenant_id())
  );

-- Editing your own comment only, and edited_at makes it visible.
CREATE POLICY comments_update ON public.proposal_comments FOR UPDATE TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND author_id = (SELECT m.id FROM public.memberships m
                     WHERE m.user_id = coram.current_user_id()
                       AND m.tenant_id = coram.current_tenant_id())
  )
  WITH CHECK (tenant_id = coram.current_tenant_id());

CREATE POLICY amendments_select ON public.amendments FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY amendments_write ON public.amendments FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal', 'observer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal', 'observer'));

CREATE POLICY ballots_select ON public.ballots FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY ballots_write ON public.ballots FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- Who was eligible and who has collected a token is public within the
-- workspace: turnout is a legitimate thing for members to see, and it reveals
-- nothing about how anyone voted.
CREATE POLICY enrollments_select ON public.ballot_enrollments FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

/*
 * ballot_tokens has no SELECT policy for anyone. None.
 *
 * Nobody needs to read the token list — the tally is computed from votes, and
 * spend-checking happens inside cast_secret_vote, which is SECURITY DEFINER.
 * Granting a read here would let a steward correlate spend times against
 * anything else they can see, which is the attack the coarse cast_hour on
 * votes already guards against. Leaving it unreadable closes the other half.
 */

-- Votes are readable so the tally can be computed and audited by members. For
-- a secret ballot the rows carry a token hash and no voter, so this discloses
-- the distribution and nothing else.
CREATE POLICY votes_select ON public.votes FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

-- No INSERT policy: secret votes go through cast_secret_vote. Recorded votes
-- have their own narrow policy below.
CREATE POLICY votes_insert_recorded ON public.votes FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND token_hash IS NULL
    AND membership_id = (SELECT m.id FROM public.memberships m
                         WHERE m.user_id = coram.current_user_id()
                           AND m.tenant_id = coram.current_tenant_id())
    AND EXISTS (SELECT 1 FROM public.ballots b
                WHERE b.id = votes.ballot_id AND NOT b.is_secret AND b.closed_at IS NULL)
  );

-- A proxy is visible to the two people it concerns, and to a steward running
-- the meeting. Not to the whole workspace: who has delegated to whom is a
-- political fact about a person.
CREATE POLICY proxies_select ON public.proxies FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (
      coram.has_role('steward')
      OR grantor_id = (SELECT m.id FROM public.memberships m
                       WHERE m.user_id = coram.current_user_id()
                         AND m.tenant_id = coram.current_tenant_id())
      OR grantee_id = (SELECT m.id FROM public.memberships m
                       WHERE m.user_id = coram.current_user_id()
                         AND m.tenant_id = coram.current_tenant_id())
    )
  );

-- You grant and revoke your own proxy. Nobody grants one on your behalf.
CREATE POLICY proxies_write ON public.proxies FOR ALL TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND grantor_id = (SELECT m.id FROM public.memberships m
                      WHERE m.user_id = coram.current_user_id()
                        AND m.tenant_id = coram.current_tenant_id())
  )
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND grantor_id = (SELECT m.id FROM public.memberships m
                      WHERE m.user_id = coram.current_user_id()
                        AND m.tenant_id = coram.current_tenant_id())
  );

CREATE POLICY bylaws_select ON public.bylaws FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY bylaws_write ON public.bylaws FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY bylaw_versions_select ON public.bylaw_versions FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

-- INSERT only. A bylaw version is never edited or deleted — the history is the
-- reason it lives here rather than in a shared document.
CREATE POLICY bylaw_versions_insert ON public.bylaw_versions FOR INSERT TO coram_app
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY minutes_select ON public.minutes FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY minutes_write ON public.minutes FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals          TO coram_app;
GRANT SELECT, INSERT, UPDATE         ON public.proposal_comments  TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amendments         TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ballots            TO coram_app;
GRANT SELECT                         ON public.ballot_enrollments TO coram_app;
GRANT SELECT, INSERT                 ON public.votes              TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proxies            TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bylaws             TO coram_app;
GRANT SELECT, INSERT                 ON public.bylaw_versions     TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minutes            TO coram_app;
-- ballot_tokens: no grant at all. Reached only through the SECURITY DEFINER
-- functions above.

GRANT SELECT, UPDATE, DELETE ON public.votes             TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.ballot_tokens     TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.ballot_enrollments TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.proposal_comments TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.proxies           TO coram_cron;

REVOKE ALL ON FUNCTION coram.is_in_good_standing(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.open_ballot(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.cast_secret_vote(uuid, text, coram.vote_choice, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION coram.is_in_good_standing(uuid) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.open_ballot(uuid, text[]) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.cast_secret_vote(uuid, text, coram.vote_choice, jsonb) TO coram_app;

CREATE TRIGGER proposals_touch_updated
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

COMMIT;
