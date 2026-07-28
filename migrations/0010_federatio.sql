-- =====================================================================
-- 0010_federatio — the coalition layer (§5.11).
-- Forward-only. Do not edit after it has run anywhere.
--
-- §5.11: "Subsidiarity by default: a parent sees roll-up aggregates only.
-- Access to a chapter's individual records requires that chapter's explicit,
-- revocable grant."
--
-- §2 maps subsidiarity to "Data and decisions stay at the smallest competent
-- level. A coalition does not automatically see a chapter's records."
--
-- The word doing the work is *automatically*. The obvious implementation makes
-- a parent tenant a super-tenant whose queries span its children, and then adds
-- a setting to restrain it. This does the reverse: the tenant boundary from
-- 0001 is untouched, a parent has no read path into a child at all, and a grant
-- is what creates one — narrow, explicit, and revocable by the chapter alone.
--
-- Concretely: there is no policy anywhere below that lets a parent read a
-- child's contacts. What a parent gets is coram.chapter_rollup(), which returns
-- counts. Individual records require a grant the chapter created and can
-- destroy, and the chapter can see every grant it has made.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Federation
-- ---------------------------------------------------------------------

CREATE TABLE public.federations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The coalition's own workspace. A parent is a tenant like any other; being
  -- a parent grants nothing by itself.
  parent_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_tenant_id)
);

/*
 * Chapter membership, and it is a two-sided agreement.
 *
 * `accepted_at` is null until the chapter's own steward accepts. A coalition
 * cannot add a chapter to itself — which matters, because "we have added your
 * group to our federation" arriving as a notification rather than a request is
 * how a chapter's data ends up somewhere it did not agree to.
 */
CREATE TABLE public.federation_chapters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  federation_id uuid NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  chapter_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  invited_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  left_at     timestamptz,

  UNIQUE (federation_id, chapter_tenant_id)
);

CREATE INDEX federation_chapters_tenant_idx ON public.federation_chapters (chapter_tenant_id);

-- ---------------------------------------------------------------------
-- Grants — the only door from a parent into a chapter's records
-- ---------------------------------------------------------------------

CREATE TABLE public.federation_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  federation_id uuid NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  chapter_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- What is shared. A closed list, because "everything" should not be
  -- expressible in one row.
  scope      text NOT NULL CHECK (scope IN ('contacts', 'events', 'funds')),

  -- Optional narrowing: a single segment rather than the whole scope.
  segment_id uuid REFERENCES public.segments(id) ON DELETE CASCADE,

  granted_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),

  -- Grants expire. A coalition campaign that ended two years ago should not
  -- still be reading a chapter's contact list, and requiring a renewal is the
  -- only reliable way to make that true.
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX federation_grants_lookup_idx
  ON public.federation_grants (federation_id, chapter_tenant_id, scope)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- Shared segments (§5.11)
-- ---------------------------------------------------------------------

CREATE TABLE public.shared_segments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  federation_id uuid NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  -- The chapter that published it. Definition only; membership stays home.
  chapter_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  segment_id    uuid NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  shared_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (federation_id, segment_id)
);

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.federations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federations         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.federation_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_chapters FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.federation_grants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_grants   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shared_segments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_segments     FORCE  ROW LEVEL SECURITY;

-- Visible to the parent and to any chapter in it. Both need to know it exists.
CREATE POLICY federations_select ON public.federations FOR SELECT TO coram_app
  USING (
    parent_tenant_id = coram.current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM public.federation_chapters fc
      WHERE fc.federation_id = federations.id
        AND fc.chapter_tenant_id = coram.current_tenant_id()
        AND fc.left_at IS NULL
    )
  );

CREATE POLICY federations_write ON public.federations FOR ALL TO coram_app
  USING (parent_tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (parent_tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY chapters_select ON public.federation_chapters FOR SELECT TO coram_app
  USING (
    chapter_tenant_id = coram.current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM public.federations f
      WHERE f.id = federation_chapters.federation_id
        AND f.parent_tenant_id = coram.current_tenant_id()
    )
  );

-- A parent may invite. Only the chapter may accept or leave, which is enforced
-- by the two separate policies rather than by a check in a handler.
CREATE POLICY chapters_invite ON public.federation_chapters FOR INSERT TO coram_app
  WITH CHECK (
    accepted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.federations f
      WHERE f.id = federation_chapters.federation_id
        AND f.parent_tenant_id = coram.current_tenant_id()
        AND coram.has_role('steward')
    )
  );

CREATE POLICY chapters_respond ON public.federation_chapters FOR UPDATE TO coram_app
  USING (chapter_tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (chapter_tenant_id = coram.current_tenant_id());

/*
 * Grants.
 *
 * A chapter sees and controls its own. A parent may read the grant rows that
 * point at it — it needs to know what it has been given — but has no write
 * policy at all, so it cannot create, extend, or un-revoke one.
 */
CREATE POLICY grants_select ON public.federation_grants FOR SELECT TO coram_app
  USING (
    chapter_tenant_id = coram.current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM public.federations f
      WHERE f.id = federation_grants.federation_id
        AND f.parent_tenant_id = coram.current_tenant_id()
    )
  );

CREATE POLICY grants_write ON public.federation_grants FOR ALL TO coram_app
  USING (chapter_tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (chapter_tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY shared_segments_select ON public.shared_segments FOR SELECT TO coram_app
  USING (
    chapter_tenant_id = coram.current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM public.federations f
      WHERE f.id = shared_segments.federation_id
        AND f.parent_tenant_id = coram.current_tenant_id()
    )
  );

CREATE POLICY shared_segments_write ON public.shared_segments FOR ALL TO coram_app
  USING (chapter_tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (chapter_tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.federations         TO coram_app;
GRANT SELECT, INSERT, UPDATE         ON public.federation_chapters TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.federation_grants   TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_segments     TO coram_app;

GRANT SELECT, UPDATE, DELETE ON public.federation_grants TO coram_cron;

-- ---------------------------------------------------------------------
-- What a parent can actually see
-- ---------------------------------------------------------------------

/*
 * Roll-up. Counts, per chapter, and nothing else.
 *
 * This is the default and, absent a grant, the whole of it. Note what it does
 * not return: no names, no emails, no segment membership, no individual row of
 * any kind. A coalition can see that a chapter has 340 contacts and ran four
 * events; it cannot see who they are.
 */
CREATE FUNCTION coram.chapter_rollup()
RETURNS TABLE (
  chapter_tenant_id uuid,
  chapter_name text,
  contacts bigint,
  events_upcoming bigint,
  funds_raised_cents bigint,
  joined_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE _federation uuid;
BEGIN
  SELECT f.id INTO _federation FROM public.federations f
  WHERE f.parent_tenant_id = coram.current_tenant_id();

  IF _federation IS NULL THEN
    RAISE EXCEPTION 'coram: this workspace is not a coalition parent'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT t.id, t.name,
         (SELECT count(*) FROM public.contacts c WHERE c.tenant_id = t.id)::bigint,
         (SELECT count(*) FROM public.events e
          WHERE e.tenant_id = t.id AND e.starts_at >= now() AND e.cancelled_at IS NULL)::bigint,
         (SELECT coalesce(sum(f2.raised_cents), 0) FROM public.funds f2 WHERE f2.tenant_id = t.id)::bigint,
         fc.accepted_at
  FROM public.federation_chapters fc
  JOIN public.tenants t ON t.id = fc.chapter_tenant_id
  WHERE fc.federation_id = _federation
    AND fc.accepted_at IS NOT NULL
    AND fc.left_at IS NULL
  ORDER BY t.name;
END;
$$;

/*
 * Whether a live grant exists. One function, so the answer is defined in a
 * single place and a route cannot approximate it.
 *
 * Revoked counts as absent. Expired counts as absent. Both are checked here
 * rather than left to a WHERE clause somebody might omit.
 */
CREATE FUNCTION coram.has_federation_grant(_chapter_tenant_id uuid, _scope text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.federation_grants g
    JOIN public.federations f ON f.id = g.federation_id
    WHERE f.parent_tenant_id = coram.current_tenant_id()
      AND g.chapter_tenant_id = _chapter_tenant_id
      AND g.scope = _scope
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  )
$$;

REVOKE ALL ON FUNCTION coram.chapter_rollup() FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.has_federation_grant(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.chapter_rollup() TO coram_app;
GRANT EXECUTE ON FUNCTION coram.has_federation_grant(uuid, text) TO coram_app;

/*
 * Deliberately absent: any function that returns a chapter's individual rows to
 * a parent.
 *
 * A grant is currently a recorded, auditable permission that the coalition
 * layer's own routes consult — not a widening of RLS. Making it one would mean
 * a policy on public.contacts admitting a parent tenant, and that is a change
 * to the boundary every other module depends on. It should be made deliberately
 * if it is made at all; see docs/federation.md.
 */

COMMIT;
