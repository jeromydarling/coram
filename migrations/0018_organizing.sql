-- ---------------------------------------------------------------------
-- 0018 — the public page a group chooses to have
--
-- Convocare (§5.3) already publishes one page per event at /e/<slug>. This
-- adds one page per workspace at /g/<slug>: who they are, in their own words,
-- and which of their events are open to anyone.
--
-- ---------------------------------------------------------------------
-- Off by default, and that is the whole design
-- ---------------------------------------------------------------------
--
-- Publishing "the Eastside Tenants Union exists, here is what they are doing
-- and here is how to reach them" is a disclosure about a political
-- organisation, and for a good number of the groups this product is for it is
-- the disclosure that matters most. Several of them would be endangered by a
-- page they did not ask for.
--
-- So there is no derived default, no "we generated one for you", and no way to
-- end up with a live page by leaving a setting alone. A steward writes the
-- words, sets published to true, and can unset it in one click. Until then
-- /g/<slug> is a 404 that is indistinguishable from a workspace that does not
-- exist — which is the point: an adversary probing slugs learns nothing about
-- who is here and has chosen not to publish.
--
-- ---------------------------------------------------------------------
-- What the page can never contain
-- ---------------------------------------------------------------------
--
-- No member is nameable from it. The columns below hold text a steward typed
-- and nothing joined from contacts, memberships or RSVPs. `coram.public_group`
-- returns counts at most, on the same reasoning as `coram.public_event`: a
-- public attendee list is a roster of who will be at an action.
--
-- The contact line is free text on purpose rather than a foreign key to a
-- member. A group publishing a way to reach them should publish a shared
-- address they control — not a named organiser's inbox, which is what a
-- picker of members would encourage on the day somebody is in a hurry.
-- ---------------------------------------------------------------------

CREATE TABLE public.public_pages (
  tenant_id   uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Off until a steward says otherwise. See the header note.
  published   boolean NOT NULL DEFAULT false,

  -- One line under the name. "Tenants organising for repairs in Eastside."
  tagline     text CHECK (tagline IS NULL OR length(tagline) <= 160),

  -- A few paragraphs, plain text. Rendered as text, never as markup — this is
  -- a page served to strangers and the group's own words are the only content
  -- on it, so there is no reason to accept HTML and every reason not to.
  about       text CHECK (about IS NULL OR length(about) <= 4000),

  -- How to reach them. A shared address the group controls, in their words.
  contact     text CHECK (contact IS NULL OR length(contact) <= 300),

  -- What to do first. Free text rather than a link, because for most groups
  -- the answer is "come to the Tuesday meeting" rather than a URL.
  get_involved text CHECK (get_involved IS NULL OR length(get_involved) <= 600),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_pages FORCE  ROW LEVEL SECURITY;

-- Readable by the workspace, because what is published in the group's name is
-- the group's business. `legal` excluded as everywhere else.
CREATE POLICY public_pages_select ON public.public_pages FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

-- Stewards only. This is the one setting in the product that makes something
-- visible to people who are not in the room, and an organizer flipping it by
-- accident is a disclosure nobody authorised.
CREATE POLICY public_pages_write ON public.public_pages FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE TRIGGER public_pages_touch BEFORE UPDATE ON public.public_pages
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_pages TO coram_app;

-- ---------------------------------------------------------------------
-- Reading it without a session
-- ---------------------------------------------------------------------

/*
 * The page itself. SECURITY DEFINER because the caller has no session at all —
 * same pattern as coram.public_event, and the same discipline: it returns
 * exactly the columns the page renders and no identifier that would let a
 * caller walk into anything else.
 *
 * Returns nothing when `published` is false, so an unpublished workspace and a
 * slug that was never taken are indistinguishable from outside.
 */
CREATE FUNCTION coram.public_group(_slug text)
RETURNS TABLE (
  tenant_id uuid, name text, tagline text, about text,
  contact text, get_involved text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.id, t.name, p.tagline, p.about, p.contact, p.get_involved
  FROM public.tenants t
  JOIN public.public_pages p ON p.tenant_id = t.id
  WHERE t.slug = _slug AND p.published
$$;

/*
 * The group's open events, soonest first.
 *
 * Only events already public in their own right — `is_public` with a slug —
 * because a group turning on a page must not thereby publish the internal
 * meetings they never advertised. The two decisions stay separate, one per
 * event, exactly as they were before this page existed.
 *
 * A count of who is going, never who. See coram.public_event.
 */
CREATE FUNCTION coram.public_group_events(_slug text)
RETURNS TABLE (
  title text, starts_at timestamptz, ends_at timestamptz,
  location_name text, public_slug text, spots_taken bigint, capacity integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.title, e.starts_at, e.ends_at, e.location_name, e.public_slug,
         (SELECT count(*) FROM public.rsvps r
          WHERE r.event_id = e.id AND r.status = 'going')::bigint,
         e.capacity
  FROM public.events e
  JOIN public.tenants t       ON t.id = e.tenant_id
  JOIN public.public_pages p  ON p.tenant_id = t.id
  WHERE t.slug = _slug
    AND p.published
    AND e.is_public
    AND e.public_slug IS NOT NULL
    AND e.cancelled_at IS NULL
    AND e.starts_at > now()
  ORDER BY e.starts_at
  LIMIT 20
$$;

REVOKE ALL ON FUNCTION coram.public_group(text)        FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.public_group_events(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.public_group(text)        TO coram_app;
GRANT EXECUTE ON FUNCTION coram.public_group_events(text) TO coram_app;
