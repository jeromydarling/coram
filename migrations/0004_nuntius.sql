-- =====================================================================
-- 0004_nuntius — outreach (§5.4).
-- Forward-only. Do not edit after it has run anywhere.
--
-- §5.4, emphasis in the original: "Global opt-out ledger enforced across every
-- channel — one unsubscribe stops everything, forever, tenant-wide. No
-- exceptions, no 'transactional' loophole."
--
-- Two words in that sentence set the whole design of this migration.
--
-- "Forever" collides with §3.4, which requires every table holding personal
-- data to declare a finite retention. An opt-out that expires is an opt-out
-- that fails, so one of the two rules would have to bend — unless the ledger
-- holds no personal data at all. It does not. `suppressions` stores a peppered
-- hash of the address, never the address. It can therefore be kept forever
-- under §3.4 as written, and the harder case works too: when someone
-- unsubscribes and we later purge their contact record, the suppression
-- survives without us still holding an address we promised to delete.
--
-- "Enforced" is the reason this is a trigger and not a helper function. A
-- BEFORE INSERT trigger on every outbound table derives the recipient's hash
-- from the contact row itself and refuses the insert if it is suppressed. A
-- future module that adds a send path cannot forget to check, because there is
-- no code path to forget in. There is deliberately no bypass flag, no
-- `is_transactional` column, and no SECURITY DEFINER escape hatch. If you are
-- here to add one, that is the loophole §5.4 names.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Recipient hashes on contacts.
--
-- Maintained by the Worker, which holds the pepper (a Worker secret, never in
-- this database). A dump of Postgres therefore cannot test whether a given
-- address is on the suppression list — the pepper is not in it.
--
-- Worth being precise about what this does and does not buy, in the same
-- spirit as the vault: it means the ledger holds no readable address, and that
-- a database disclosure alone cannot enumerate or check membership. It is
-- minimization plus a real barrier, not an unbreakable one — anyone holding
-- both the database and the pepper can test a candidate address.
-- ---------------------------------------------------------------------

ALTER TABLE public.contacts ADD COLUMN email_hash text;
ALTER TABLE public.contacts ADD COLUMN phone_hash text;

CREATE INDEX contacts_email_hash_idx ON public.contacts (email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX contacts_phone_hash_idx ON public.contacts (phone_hash) WHERE phone_hash IS NOT NULL;

-- ---------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------

CREATE TABLE public.suppressions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- 'email' and 'sms' are addresses; 'all' suppresses a person across every
  -- channel from a single act, which is what "one unsubscribe stops
  -- everything" means when someone replies STOP to a text.
  channel    text NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'all')),

  -- HMAC-SHA256(pepper, channel || ':' || normalized identifier). Never the
  -- address itself. There is no column here that could hold one.
  identifier_hash text NOT NULL,

  reason     text NOT NULL DEFAULT 'unsubscribed'
               CHECK (reason IN ('unsubscribed', 'complaint', 'bounce', 'manual')),
  source     text NOT NULL DEFAULT 'self_service'
               CHECK (source IN ('self_service', 'admin', 'system')),

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, channel, identifier_hash)
);

CREATE INDEX suppressions_lookup_idx ON public.suppressions (tenant_id, identifier_hash);

-- Unsubscribe links. Hash stored, token emailed — same discipline as 0001.
-- These are short-lived; the suppression they create is not.
CREATE TABLE public.unsubscribe_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------

CREATE TABLE public.campaigns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  name       text NOT NULL,
  channel    text NOT NULL CHECK (channel IN ('email', 'sms')),

  subject    text,
  -- Merge fields are {{display_name}} style, resolved per recipient at send
  -- time and never stored expanded.
  body       text NOT NULL,

  segment_id uuid REFERENCES public.segments(id) ON DELETE SET NULL,

  status     text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'cancelled')),

  scheduled_at timestamptz,
  sent_at      timestamptz,

  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT campaigns_email_needs_subject CHECK (channel <> 'email' OR subject IS NOT NULL)
);

CREATE INDEX campaigns_tenant_idx ON public.campaigns (tenant_id, created_at DESC);

-- Per-recipient delivery state. This is what the deliverability dashboard
-- reads and what bounce and complaint webhooks update.
--
-- Note there is no copy of the rendered message body here. Storing what was
-- sent to each person would double the content and make the retention story
-- twice as hard; the campaign body plus the contact is enough to reconstruct
-- it if anyone genuinely needs to.
CREATE TABLE public.campaign_sends (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  status      text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
  failure_kind text,

  queued_at   timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  settled_at  timestamptz,

  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX campaign_sends_campaign_idx ON public.campaign_sends (campaign_id, status);
CREATE INDEX campaign_sends_contact_idx ON public.campaign_sends (contact_id);

-- ---------------------------------------------------------------------
-- Peer-to-peer texting (§5.4)
-- ---------------------------------------------------------------------

CREATE TABLE public.conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- The volunteer holding this thread. P2P means a person on both ends, and
  -- throttling is per sender, so the assignment has to be a real column.
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,

  last_message_at timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, contact_id)
);

CREATE INDEX conversations_assigned_idx ON public.conversations (assigned_to, last_message_at DESC);

CREATE TABLE public.messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,

  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  body      text NOT NULL,

  sent_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, sent_at);

-- ---------------------------------------------------------------------
-- Phone bank (§5.4)
-- ---------------------------------------------------------------------

-- A branching script. The tree is jsonb: nodes with prompts and answers that
-- point at the next node.
CREATE TABLE public.call_scripts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  tree       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- The outcome of a call, not a recording of one. There is no audio column and
-- no transcript column, and neither is coming: a recorded conversation with a
-- supporter is precisely the sort of thing §3 exists to keep out of the
-- schema.
CREATE TABLE public.call_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  script_id  uuid REFERENCES public.call_scripts(id) ON DELETE SET NULL,
  caller_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,

  outcome    text NOT NULL
               CHECK (outcome IN ('answered', 'no_answer', 'voicemail', 'wrong_number',
                                  'refused', 'do_not_call', 'callback_requested')),
  -- Answers to the script's questions, keyed by node id. Structured, short,
  -- and chosen by the caller from the script — not free-form notes about a
  -- person, which belong in the encrypted vault if anywhere.
  answers    jsonb NOT NULL DEFAULT '{}'::jsonb,

  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX call_attempts_contact_idx ON public.call_attempts (contact_id, attempted_at DESC);
CREATE INDEX call_attempts_script_idx ON public.call_attempts (script_id);

-- ---------------------------------------------------------------------
-- Enforcement.
--
-- One function, three triggers. Derives the recipient hash from the contact
-- row rather than trusting anything the caller passed, so a handler cannot
-- suppress-check the wrong address by accident or on purpose.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.is_suppressed(_contact_id uuid, _channel text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts c
    JOIN public.suppressions s
      ON s.tenant_id = c.tenant_id
     AND s.identifier_hash = CASE _channel
                               WHEN 'email' THEN c.email_hash
                               ELSE c.phone_hash
                             END
    WHERE c.id = _contact_id
      -- 'all' is what a STOP reply writes: one act, every channel.
      AND s.channel IN (_channel, 'all')
  )
$$;

CREATE FUNCTION coram.refuse_if_suppressed() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  _channel   text;
  _contact   uuid;
BEGIN
  IF TG_TABLE_NAME = 'campaign_sends' THEN
    SELECT c.channel INTO _channel FROM public.campaigns c WHERE c.id = NEW.campaign_id;
    _contact := NEW.contact_id;

  ELSIF TG_TABLE_NAME = 'messages' THEN
    -- Inbound is someone texting us. Refusing to record that would lose the
    -- STOP reply itself, which is the message that creates the suppression.
    IF NEW.direction <> 'outbound' THEN RETURN NEW; END IF;
    _channel := 'sms';
    SELECT v.contact_id INTO _contact
    FROM public.conversations v WHERE v.id = NEW.conversation_id;

  ELSIF TG_TABLE_NAME = 'call_attempts' THEN
    _channel := 'phone';
    _contact := NEW.contact_id;
  END IF;

  IF coram.is_suppressed(_contact, _channel) THEN
    RAISE EXCEPTION 'coram: % is opted out of % and will not be contacted', _contact, _channel
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER campaign_sends_respect_optout
  BEFORE INSERT ON public.campaign_sends
  FOR EACH ROW EXECUTE FUNCTION coram.refuse_if_suppressed();

CREATE TRIGGER messages_respect_optout
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION coram.refuse_if_suppressed();

CREATE TRIGGER call_attempts_respect_optout
  BEFORE INSERT ON public.call_attempts
  FOR EACH ROW EXECUTE FUNCTION coram.refuse_if_suppressed();

-- A caller reporting 'do_not_call' has been told directly. Recording it and
-- then leaving them callable would be the worst kind of paper compliance.
CREATE FUNCTION coram.suppress_on_do_not_call() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE _hash text;
BEGIN
  IF NEW.outcome <> 'do_not_call' THEN RETURN NEW; END IF;

  SELECT phone_hash INTO _hash FROM public.contacts WHERE id = NEW.contact_id;
  IF _hash IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.suppressions (tenant_id, channel, identifier_hash, reason, source)
  VALUES (NEW.tenant_id, 'phone', _hash, 'unsubscribed', 'system')
  ON CONFLICT (tenant_id, channel, identifier_hash) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER call_attempts_do_not_call
  AFTER INSERT ON public.call_attempts
  FOR EACH ROW EXECUTE FUNCTION coram.suppress_on_do_not_call();

-- ---------------------------------------------------------------------
-- Unsubscribing.
--
-- Public: the person clicking has no session. Takes a token, writes the
-- suppression, and deletes the token. Idempotent, because people click twice.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.unsubscribe_by_token(_token_hash text, _channel text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tok  public.unsubscribe_tokens%ROWTYPE;
  _hash text;
BEGIN
  SELECT * INTO _tok FROM public.unsubscribe_tokens WHERE token_hash = _token_hash;
  IF _tok.id IS NULL THEN RETURN false; END IF;

  SELECT CASE WHEN _channel = 'email' THEN email_hash ELSE phone_hash END
  INTO _hash FROM public.contacts WHERE id = _tok.contact_id;

  IF _hash IS NOT NULL THEN
    INSERT INTO public.suppressions (tenant_id, channel, identifier_hash, reason, source)
    VALUES (_tok.tenant_id, _channel, _hash, 'unsubscribed', 'self_service')
    ON CONFLICT (tenant_id, channel, identifier_hash) DO NOTHING;
  END IF;

  -- Also suppress every other channel we can reach them on. §5.4 says one
  -- unsubscribe stops everything; honouring it only for the channel the link
  -- happened to arrive on would be the loophole in a different costume.
  INSERT INTO public.suppressions (tenant_id, channel, identifier_hash, reason, source)
  SELECT _tok.tenant_id, 'all', h, 'unsubscribed', 'self_service'
  FROM (
    SELECT email_hash AS h FROM public.contacts WHERE id = _tok.contact_id AND email_hash IS NOT NULL
    UNION
    SELECT phone_hash FROM public.contacts WHERE id = _tok.contact_id AND phone_hash IS NOT NULL
  ) hashes
  ON CONFLICT (tenant_id, channel, identifier_hash) DO NOTHING;

  DELETE FROM public.unsubscribe_tokens WHERE id = _tok.id;
  RETURN true;
END;
$$;

/*
 * Suppress by raw hash. Used by the inbound STOP handler and by bounce and
 * complaint webhooks, which know an address but have no session and may not
 * have a contact row at all.
 */
CREATE FUNCTION coram.suppress_hash(
  _tenant_id uuid, _channel text, _hash text, _reason text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO public.suppressions (tenant_id, channel, identifier_hash, reason, source)
  VALUES (_tenant_id, _channel, _hash, _reason, 'system')
  ON CONFLICT (tenant_id, channel, identifier_hash) DO NOTHING
$$;

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.suppressions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressions        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.unsubscribe_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsubscribe_tokens  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns           FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sends      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sends      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations       FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.call_scripts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_scripts        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.call_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_attempts       FORCE  ROW LEVEL SECURITY;

-- suppressions: readable by anyone who can send, so the UI can show why a
-- contact is greyed out. No UPDATE and no DELETE policy anywhere — an opt-out
-- cannot be edited or removed through the application, by anyone, including a
-- steward. Reversing one requires database access and a reason you would be
-- willing to state in a transparency report.
CREATE POLICY suppressions_select ON public.suppressions FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY suppressions_insert ON public.suppressions FOR INSERT TO coram_app
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY unsubscribe_tokens_insert ON public.unsubscribe_tokens FOR INSERT TO coram_app
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY campaigns_write ON public.campaigns FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

-- Who was sent what is personal data, so this follows the contact predicate.
CREATE POLICY campaign_sends_select ON public.campaign_sends FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = campaign_sends.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY campaign_sends_write ON public.campaign_sends FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = campaign_sends.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

-- P2P is peer to peer: a volunteer sees the threads they hold, a steward sees
-- all of them. An organizer does not get to read a colleague's conversations
-- just because the contact is in their turf.
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (coram.has_role('steward') OR assigned_to = coram.current_user_id())
  );

CREATE POLICY conversations_write ON public.conversations FOR ALL TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (coram.has_role('steward') OR assigned_to = coram.current_user_id())
  )
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY messages_select ON public.messages FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.conversations v
    WHERE v.id = messages.conversation_id
      AND v.tenant_id = coram.current_tenant_id()
      AND (coram.has_role('steward') OR v.assigned_to = coram.current_user_id())
  ));

CREATE POLICY messages_insert ON public.messages FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations v
      WHERE v.id = messages.conversation_id
        AND (coram.has_role('steward') OR v.assigned_to = coram.current_user_id())
    )
  );

CREATE POLICY call_scripts_select ON public.call_scripts FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY call_scripts_write ON public.call_scripts FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY call_attempts_select ON public.call_attempts FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = call_attempts.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY call_attempts_insert ON public.call_attempts FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = call_attempts.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT                 ON public.suppressions       TO coram_app;
GRANT INSERT                         ON public.unsubscribe_tokens TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns          TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_sends     TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations      TO coram_app;
GRANT SELECT, INSERT                 ON public.messages           TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_scripts       TO coram_app;
GRANT SELECT, INSERT                 ON public.call_attempts      TO coram_app;

-- Note: no DELETE on suppressions for coram_cron either. The nightly sweep
-- must never be the thing that quietly un-suppresses someone.
GRANT SELECT, UPDATE, DELETE ON public.campaign_sends     TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.messages           TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.conversations      TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.call_attempts      TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.unsubscribe_tokens TO coram_cron;

REVOKE ALL ON FUNCTION coram.is_suppressed(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.unsubscribe_by_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.suppress_hash(uuid, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION coram.is_suppressed(uuid, text) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.unsubscribe_by_token(text, text) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.suppress_hash(uuid, text, text, text) TO coram_app;

CREATE TRIGGER campaigns_touch_updated
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

-- ---------------------------------------------------------------------
-- Public RSVP has to learn about hashes.
--
-- 0003 wrote coram.public_rsvp before this ledger existed, so it creates
-- contacts with null email_hash and phone_hash. That is a real hole rather
-- than an untidiness: someone unsubscribes, their contact is later purged,
-- they then sign up for an event, and the new row has no hash for the trigger
-- to match — so the ledger fails open on exactly the case it was designed for.
--
-- The Worker computes the hashes (it holds the pepper) and passes them in.
-- Signature change, so this is a drop and recreate rather than a replace.
-- ---------------------------------------------------------------------

DROP FUNCTION coram.public_rsvp(text, text, text, text, text, integer, boolean, integer, text, text);

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
  _checkin_token_hash text,
  _email_hash text,
  _phone_hash text
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

  -- Someone who told this workspace to stop contacting them has not signed up
  -- for an event by being handed a link. Refusing here rather than creating the
  -- contact and letting a later send fail keeps the opt-out meaningful: we do
  -- not re-acquire a record on someone who opted out.
  IF EXISTS (
    SELECT 1 FROM public.suppressions s
    WHERE s.tenant_id = _event.tenant_id
      AND s.identifier_hash IN (_email_hash, _phone_hash)
      AND s.channel = 'all'
  ) THEN
    RAISE EXCEPTION 'coram: that person has opted out of contact from this workspace'
      USING ERRCODE = 'check_violation';
  END IF;

  IF _email IS NOT NULL THEN
    SELECT id INTO _contact_id FROM public.contacts
    WHERE tenant_id = _event.tenant_id AND lower(email) = lower(_email);
  END IF;

  IF _contact_id IS NULL THEN
    INSERT INTO public.contacts
      (tenant_id, display_name, email, phone, postal_code, email_hash, phone_hash)
    VALUES (
      _event.tenant_id,
      coalesce(nullif(trim(_display_name), ''), _email, _phone),
      _email, _phone, _postal_code, _email_hash, _phone_hash
    )
    RETURNING id INTO _contact_id;

    INSERT INTO public.consent_records
      (tenant_id, contact_id, channel, granted, acquisition, note)
    VALUES (
      _event.tenant_id, _contact_id, 'any', true, 'event_rsvp',
      'Signed up for: ' || _event.title
    );
  END IF;

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

REVOKE ALL ON FUNCTION coram.public_rsvp(text, text, text, text, text, integer, boolean, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.public_rsvp(text, text, text, text, text, integer, boolean, integer, text, text, text, text) TO coram_app;

-- A contact with no hash cannot be protected by the triggers above, so make
-- that visible rather than silent. Not a CHECK constraint: a contact may
-- legitimately have neither an email nor a phone, and a null hash is correct
-- there. This is the diagnostic an operator runs when a send goes somewhere it
-- should not have.
CREATE VIEW coram.contacts_missing_hashes AS
  SELECT id, tenant_id,
         (email IS NOT NULL AND email_hash IS NULL) AS email_unhashed,
         (phone IS NOT NULL AND phone_hash IS NULL) AS phone_unhashed
  FROM public.contacts
  WHERE (email IS NOT NULL AND email_hash IS NULL)
     OR (phone IS NOT NULL AND phone_hash IS NULL);

GRANT SELECT ON coram.contacts_missing_hashes TO coram_cron;

COMMIT;
