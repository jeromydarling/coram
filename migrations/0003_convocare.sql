-- =====================================================================
-- 0003_convocare — events, shifts, RSVPs, check-in (§5.3).
-- Forward-only. Do not edit after it has run anywhere.
--
-- Two constraints shape this migration more than anything else.
--
-- §3.1: "Event attendance is a boolean check-in with a timestamp. There is no
-- GPS trail table and never will be." So `check_ins` holds a contact, an
-- event, and a time. There is no latitude column to leave null later.
--
-- §5.3: accessibility fields on *every* event — transit, ramp, ASL, quiet
-- space. Not an optional extension table that most events skip, but columns on
-- `events` that an organizer has to look at while creating one. A field you
-- have to decline is answered far more often than a field you have to find.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------

CREATE TABLE public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  title       text NOT NULL,
  description text,

  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,

  -- A venue, not a person's home. Public meeting places are the point of an
  -- event page, so this is an address rather than the coarse postal code we
  -- hold on a contact.
  location_name    text,
  location_address text,

  -- NULL means uncapped. A waitlist only exists once there is a number to be
  -- over.
  capacity    integer CHECK (capacity IS NULL OR capacity > 0),

  -- Public events get a page at /e/<slug> readable without a session.
  is_public   boolean NOT NULL DEFAULT false,
  public_slug text UNIQUE,

  -- §5.3 accessibility. Tri-state on purpose: true, false, and "nobody has
  -- said". An unanswered question must not read as "no" to someone deciding
  -- whether they can physically attend.
  access_transit      boolean,
  access_step_free    boolean,
  access_asl          boolean,
  access_quiet_space  boolean,
  access_notes        text,

  -- Recurrence. `recurrence_rule` is an RFC 5545 RRULE on the parent; each
  -- occurrence is its own row pointing back, so one instance can be moved or
  -- cancelled without unpicking the series.
  recurrence_rule  text,
  parent_event_id  uuid REFERENCES public.events(id) ON DELETE CASCADE,

  cancelled_at timestamptz,
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT events_end_after_start CHECK (ends_at IS NULL OR ends_at >= starts_at),
  -- A public event with no slug is unreachable; a slug on a private event is a
  -- URL that looks shareable and is not.
  CONSTRAINT events_public_needs_slug CHECK (is_public = (public_slug IS NOT NULL))
);

CREATE INDEX events_tenant_start_idx ON public.events (tenant_id, starts_at DESC);
CREATE INDEX events_parent_idx ON public.events (parent_event_id) WHERE parent_event_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------

CREATE TABLE public.event_shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  name        text NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,

  -- How many people this slot needs.
  slots       integer NOT NULL DEFAULT 1 CHECK (slots > 0),

  -- Free-text skills — 'spanish', 'can lift', 'legal observer trained'. A
  -- controlled vocabulary would be wrong here: every group's needs differ, and
  -- a fixed list invites recording things about people we should not hold.
  required_skills text[] NOT NULL DEFAULT '{}',

  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_shifts_end_after_start CHECK (ends_at >= starts_at)
);

CREATE INDEX event_shifts_event_idx ON public.event_shifts (event_id, starts_at);

-- ---------------------------------------------------------------------
-- rsvps
-- ---------------------------------------------------------------------

CREATE TABLE public.rsvps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  status      text NOT NULL DEFAULT 'going'
                CHECK (status IN ('going', 'waitlist', 'declined', 'cancelled')),
  guest_count integer NOT NULL DEFAULT 0 CHECK (guest_count >= 0),

  -- §5.3 carpool and childcare.
  --
  -- needs_ride / can_offer_ride are booleans and matching is done on the
  -- postal code already held on the contact. There is no pickup-address
  -- column: an organizer arranging a lift can ask, and a table of where
  -- people live is exactly what §3.1 rules out.
  needs_ride     boolean NOT NULL DEFAULT false,
  can_offer_ride boolean NOT NULL DEFAULT false,
  ride_seats     integer NOT NULL DEFAULT 0 CHECK (ride_seats >= 0),

  -- A count, so childcare can be staffed. Deliberately no ages and no names:
  -- planning needs a number, and a table of children at a protest is not
  -- something we are willing to have subpoenaed.
  childcare_children integer NOT NULL DEFAULT 0 CHECK (childcare_children >= 0),

  -- Accessibility needs the person chose to state. Free text, and the UI says
  -- it is shared with organizers before it is typed.
  access_needs text,

  -- QR check-in (§5.3). We store a hash; the QR encodes the token. A database
  -- disclosure yields no working check-in codes, and the same discipline is
  -- used for auth tokens in 0001.
  checkin_token_hash text UNIQUE,

  responded_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, contact_id)
);

CREATE INDEX rsvps_event_status_idx ON public.rsvps (event_id, status);
CREATE INDEX rsvps_contact_idx ON public.rsvps (contact_id);

CREATE TABLE public.shift_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shift_id   uuid NOT NULL REFERENCES public.event_shifts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, contact_id)
);

CREATE INDEX shift_signups_shift_idx ON public.shift_signups (shift_id);

-- ---------------------------------------------------------------------
-- check-ins — §3.1, a boolean and a timestamp
--
-- contact_id is nullable, which looks like an oversight and is not. Attendance
-- counts are the one figure a group reports to funders and to itself, and they
-- must not quietly change when the retention sweep runs. So this table
-- anonymizes rather than deletes: at the retention horizon `contact_id` is
-- nulled and the row survives, so "47 people came" stays true while "who they
-- were" stops being held. See the registration in schema/convocare.ts.
-- ---------------------------------------------------------------------

CREATE TABLE public.check_ins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id   uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX check_ins_event_idx ON public.check_ins (event_id);
-- One check-in per person per event, while we still know who they were.
CREATE UNIQUE INDEX check_ins_event_contact_key
  ON public.check_ins (event_id, contact_id) WHERE contact_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.event_shifts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shifts  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.rsvps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shift_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_signups FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.check_ins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins     FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Policies
--
-- An event is workspace information rather than personal data, so everyone in
-- the workspace can read one — including `observer`, who needs to see what is
-- happening to report on it. `legal` is scoped to Custos and gets nothing.
--
-- Who RSVP'd is personal data, so rsvps, shift_signups and check_ins follow
-- coram.can_see_contact from 0002. An observer counts attendance through the
-- aggregate function; they never see a row.
-- ---------------------------------------------------------------------

CREATE POLICY events_select ON public.events FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY events_write ON public.events FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY event_shifts_select ON public.event_shifts FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY event_shifts_write ON public.event_shifts FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY rsvps_select ON public.rsvps FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = rsvps.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY rsvps_write ON public.rsvps FOR ALL TO coram_app
  USING (
    coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = rsvps.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  )
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = rsvps.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

CREATE POLICY shift_signups_select ON public.shift_signups FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = shift_signups.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY shift_signups_write ON public.shift_signups FOR ALL TO coram_app
  USING (
    coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = shift_signups.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  )
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = shift_signups.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

-- An anonymized check-in (contact_id IS NULL) is no longer about anyone, so it
-- stays readable to stewards and organizers as attendance history.
CREATE POLICY check_ins_select ON public.check_ins FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND (
      contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = check_ins.contact_id
          AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
      )
    )
  );

CREATE POLICY check_ins_write ON public.check_ins FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events        TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shifts  TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rsvps         TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_signups TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins     TO coram_app;

GRANT SELECT, UPDATE, DELETE ON public.rsvps         TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.shift_signups TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.check_ins     TO coram_cron;

CREATE TRIGGER events_touch_updated
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

-- ---------------------------------------------------------------------
-- Public event pages (§5.3)
--
-- These run with no session at all — a stranger following a link has no
-- tenant, no role, and no RLS context. So, like the auth functions in 0001,
-- they are narrow SECURITY DEFINER functions that return exactly what a public
-- page needs and nothing more.
--
-- Note what public_event does not return: no attendee list, no RSVP count by
-- name, no organizer contact details. A public event page that leaks who is
-- coming is a list of who will be at a protest.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.public_event(_slug text)
RETURNS TABLE (
  id uuid, tenant_id uuid, title text, description text,
  starts_at timestamptz, ends_at timestamptz,
  location_name text, location_address text,
  capacity integer, spots_taken bigint,
  access_transit boolean, access_step_free boolean,
  access_asl boolean, access_quiet_space boolean, access_notes text,
  cancelled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.id, e.tenant_id, e.title, e.description,
         e.starts_at, e.ends_at,
         e.location_name, e.location_address,
         e.capacity,
         -- A count, never the people. Lets the page say "12 of 40 spots".
         (SELECT count(*) FROM public.rsvps r
          WHERE r.event_id = e.id AND r.status = 'going')::bigint,
         e.access_transit, e.access_step_free,
         e.access_asl, e.access_quiet_space, e.access_notes,
         e.cancelled_at IS NOT NULL
  FROM public.events e
  WHERE e.public_slug = _slug AND e.is_public
$$;

/*
 * Public RSVP.
 *
 * Creates the contact if the email is new, reuses it if not, records the RSVP,
 * and writes a consent record — because someone signing up for an event has
 * told us how we came to have them, and §5.1 says that goes in the ledger at
 * the moment it happens rather than being reconstructed later.
 *
 * Waitlisting is decided here rather than in the Worker so that two people
 * taking the last spot at the same moment cannot both be told they are going.
 */
CREATE FUNCTION coram.public_rsvp(
  _slug text,
  _display_name text,
  _email text,
  _phone text,
  _postal_code text,
  _guest_count integer,
  _needs_ride boolean,
  _childcare_children integer,
  _access_needs text,
  _checkin_token_hash text
)
RETURNS TABLE (rsvp_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _event      public.events%ROWTYPE;
  _contact_id uuid;
  _taken      bigint;
  _status     text;
  _rsvp_id    uuid;
BEGIN
  SELECT * INTO _event FROM public.events
  WHERE public_slug = _slug AND is_public;

  IF _event.id IS NULL THEN
    RAISE EXCEPTION 'coram: no public event at that address' USING ERRCODE = 'no_data_found';
  END IF;
  IF _event.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'coram: that event was cancelled' USING ERRCODE = 'no_data_found';
  END IF;

  IF _email IS NULL AND _phone IS NULL THEN
    RAISE EXCEPTION 'coram: an email or phone is needed to hold a place'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Match an existing supporter by email so a regular attendee does not
  -- accumulate a new contact record per event.
  IF _email IS NOT NULL THEN
    SELECT id INTO _contact_id FROM public.contacts
    WHERE tenant_id = _event.tenant_id AND lower(email) = lower(_email);
  END IF;

  IF _contact_id IS NULL THEN
    INSERT INTO public.contacts (tenant_id, display_name, email, phone, postal_code)
    VALUES (
      _event.tenant_id,
      coalesce(nullif(trim(_display_name), ''), _email, _phone),
      _email, _phone, _postal_code
    )
    RETURNING id INTO _contact_id;

    -- Only for a genuinely new contact. Re-recording provenance for someone we
    -- already had would overwrite how we actually met them.
    INSERT INTO public.consent_records
      (tenant_id, contact_id, channel, granted, acquisition, note)
    VALUES (
      _event.tenant_id, _contact_id, 'any', true, 'event_rsvp',
      'Signed up for: ' || _event.title
    );
  END IF;

  -- Counted inside the same transaction as the insert below, so the capacity
  -- check cannot be raced.
  SELECT count(*) INTO _taken FROM public.rsvps
  WHERE event_id = _event.id AND status = 'going';

  _status := CASE
    WHEN _event.capacity IS NULL THEN 'going'
    WHEN _taken + 1 + coalesce(_guest_count, 0) <= _event.capacity THEN 'going'
    ELSE 'waitlist'
  END;

  INSERT INTO public.rsvps (
    tenant_id, event_id, contact_id, status, guest_count,
    needs_ride, childcare_children, access_needs, checkin_token_hash
  )
  VALUES (
    _event.tenant_id, _event.id, _contact_id, _status, coalesce(_guest_count, 0),
    coalesce(_needs_ride, false), coalesce(_childcare_children, 0),
    _access_needs, _checkin_token_hash
  )
  ON CONFLICT (event_id, contact_id) DO UPDATE
    SET status = excluded.status,
        guest_count = excluded.guest_count,
        needs_ride = excluded.needs_ride,
        childcare_children = excluded.childcare_children,
        access_needs = excluded.access_needs,
        responded_at = now()
  RETURNING id INTO _rsvp_id;

  RETURN QUERY SELECT _rsvp_id, _status;
END;
$$;

/*
 * QR check-in (§5.3).
 *
 * Boolean and a timestamp. There is no parameter for a location because there
 * is no column for one — a phone scanning a code at a protest must not leave a
 * record of where it was.
 *
 * SECURITY DEFINER so a volunteer on the door can check people in without
 * holding a role that lets them read the contact list.
 */
CREATE FUNCTION coram.check_in_by_token(_token_hash text)
RETURNS TABLE (event_title text, already_checked_in boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _rsvp    public.rsvps%ROWTYPE;
  _title   text;
  _existed boolean;
BEGIN
  SELECT * INTO _rsvp FROM public.rsvps WHERE checkin_token_hash = _token_hash;

  IF _rsvp.id IS NULL THEN
    RAISE EXCEPTION 'coram: that code is not valid for any booking'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT title INTO _title FROM public.events WHERE id = _rsvp.event_id;

  SELECT EXISTS (
    SELECT 1 FROM public.check_ins
    WHERE event_id = _rsvp.event_id AND contact_id = _rsvp.contact_id
  ) INTO _existed;

  IF NOT _existed THEN
    INSERT INTO public.check_ins (tenant_id, event_id, contact_id)
    VALUES (_rsvp.tenant_id, _rsvp.event_id, _rsvp.contact_id);
  END IF;

  RETURN QUERY SELECT _title, _existed;
END;
$$;

REVOKE ALL ON FUNCTION coram.public_event(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.public_rsvp(text, text, text, text, text, integer, boolean, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.check_in_by_token(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION coram.public_event(text) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.public_rsvp(text, text, text, text, text, integer, boolean, integer, text, text) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.check_in_by_token(text) TO coram_app;

-- ---------------------------------------------------------------------
-- Waitlist promotion
--
-- Called when someone cancels. Promotes in the order people joined, and only
-- as far as the freed capacity allows.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.promote_from_waitlist(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _capacity integer;
  _taken    bigint;
  _promoted integer := 0;
  _row      record;
BEGIN
  SELECT capacity INTO _capacity FROM public.events WHERE id = _event_id;
  IF _capacity IS NULL THEN RETURN 0; END IF;

  SELECT coalesce(sum(1 + guest_count), 0) INTO _taken
  FROM public.rsvps WHERE event_id = _event_id AND status = 'going';

  FOR _row IN
    SELECT id, guest_count FROM public.rsvps
    WHERE event_id = _event_id AND status = 'waitlist'
    ORDER BY responded_at
  LOOP
    EXIT WHEN _taken + 1 + _row.guest_count > _capacity;
    UPDATE public.rsvps SET status = 'going' WHERE id = _row.id;
    _taken := _taken + 1 + _row.guest_count;
    _promoted := _promoted + 1;
  END LOOP;

  RETURN _promoted;
END;
$$;

REVOKE ALL ON FUNCTION coram.promote_from_waitlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.promote_from_waitlist(uuid) TO coram_app;

COMMIT;
