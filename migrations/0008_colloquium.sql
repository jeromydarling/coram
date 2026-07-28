-- =====================================================================
-- 0008_colloquium — secure internal comms (§5.7).
-- Forward-only. Do not edit after it has run anywhere.
--
-- §3.2: "No message content retention in encrypted channels. Store envelope
-- metadata only (channel id, sender id, byte length, timestamp). Purge
-- envelopes after 30 days."
--
-- Taken at its word, this migration has no message body column. Not an
-- encrypted one — none. Postgres holds envelopes: which channel, which sender,
-- how many bytes, when. The ciphertext itself lives in ChannelDO's storage for
-- exactly as long as the channel's TTL allows, so that someone whose phone was
-- off can still receive it, and then it is gone.
--
-- There is a tension worth naming rather than glossing. Durable Object storage
-- is still our infrastructure, so "the server does not retain content" is
-- precise only because that content is sealed client-side under a key we never
-- receive — the same arrangement as the notes vault (§3.3). What we hold is a
-- blob we cannot read, for a bounded window. docs/colloquium.md says so in
-- full, including what a subpoena of that window would actually yield.
-- =====================================================================

BEGIN;

CREATE TABLE public.channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  name       text,
  kind       text NOT NULL CHECK (kind IN ('channel', 'dm')),

  -- §5.7: per-channel TTL, default 30 days. Capped at 30: a channel cannot opt
  -- into keeping messages longer than §3.2 allows, so the ceiling lives in a
  -- CHECK rather than in a settings screen someone can argue with.
  ttl_days   integer NOT NULL DEFAULT 30
               CHECK (ttl_days > 0 AND ttl_days <= 30),

  created_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,

  -- A DM has no name and exactly two members; a channel has a name.
  CONSTRAINT channels_named CHECK (kind = 'dm' OR name IS NOT NULL)
);

CREATE INDEX channels_tenant_idx ON public.channels (tenant_id);

CREATE TABLE public.channel_members (
  channel_id    uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, membership_id)
);

CREATE INDEX channel_members_membership_idx ON public.channel_members (membership_id);

-- ---------------------------------------------------------------------
-- Envelopes.
--
-- Read the columns that are absent. There is no `body`, no `ciphertext`, no
-- `subject`, no `preview`, no `reply_to_excerpt`. A subpoena served on this
-- table returns who spoke in which room, how much they said, and when. That is
-- already more than nothing, and it is the floor — you cannot deliver a message
-- without knowing where to send it.
--
-- byte_length is here because §3.2 names it and because it is what makes
-- storage accounting possible without reading anything. It is also, honestly, a
-- weak signal about content length, which is why it is coarsened on write.
-- ---------------------------------------------------------------------

CREATE TABLE public.message_envelopes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id    uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id     uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  -- Rounded to the nearest 256 bytes on write. A precise length distinguishes
  -- "yes" from "no" in a two-message exchange; a bucket does not.
  byte_length   integer NOT NULL CHECK (byte_length >= 0),

  sent_at       timestamptz NOT NULL DEFAULT now(),

  -- When the ciphertext stops being deliverable. Derived from the channel's
  -- TTL at send time so changing a channel's TTL does not retroactively extend
  -- messages already sent.
  expires_at    timestamptz NOT NULL
);

CREATE INDEX message_envelopes_channel_idx ON public.message_envelopes (channel_id, sent_at DESC);

-- ---------------------------------------------------------------------
-- Attachments (§5.7) — R2 with expiring links
-- ---------------------------------------------------------------------

CREATE TABLE public.attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id  uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,

  -- Follows jobs/purge.ts's tenant-first layout so the burn switch finds it.
  r2_key      text NOT NULL UNIQUE,
  byte_length integer NOT NULL CHECK (byte_length >= 0),

  -- Not the filename. A filename is content — "eviction-notice-marquez.pdf"
  -- says everything the encryption was meant to hide. The uploader labels it,
  -- and that label is encrypted client-side like any other message.
  sealed_label text,
  nonce        text,

  uploaded_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX attachments_channel_idx ON public.attachments (channel_id, uploaded_at DESC);

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.channel_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.message_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_envelopes FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.attachments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments       FORCE  ROW LEVEL SECURITY;

/*
 * Membership of the channel is the only key.
 *
 * Note what is missing: a steward override. Being the workspace owner does not
 * put you in a room you were not invited to, and there is no policy here that
 * would let it. A steward can see that a channel exists and can delete it —
 * they pay for the workspace — but they cannot read its envelopes or join it
 * silently. An internal comms tool where the admin can quietly read the room is
 * not one organizers should use, and building the override "just in case" is
 * how it ends up being used.
 */
CREATE FUNCTION coram.in_channel(_channel_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_members cm
    JOIN public.memberships m ON m.id = cm.membership_id
    WHERE cm.channel_id = _channel_id
      AND m.user_id = coram.current_user_id()
      AND m.tenant_id = coram.current_tenant_id()
  )
$$;

CREATE POLICY channels_select ON public.channels FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (coram.in_channel(id) OR (coram.has_role('steward') AND kind = 'channel'))
  );

CREATE POLICY channels_insert ON public.channels FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND NOT coram.has_role('observer', 'legal')
  );

-- A steward may delete a channel. They cannot read it.
CREATE POLICY channels_delete ON public.channels FOR DELETE TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY channel_members_select ON public.channel_members FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id));

CREATE POLICY channel_members_write ON public.channel_members FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id));

CREATE POLICY envelopes_select ON public.message_envelopes FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id));

CREATE POLICY envelopes_insert ON public.message_envelopes FOR INSERT TO coram_app
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id));

CREATE POLICY attachments_select ON public.attachments FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id));

CREATE POLICY attachments_write ON public.attachments FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.in_channel(channel_id));

GRANT SELECT, INSERT, DELETE         ON public.channels          TO coram_app;
GRANT SELECT, INSERT, DELETE         ON public.channel_members   TO coram_app;
GRANT SELECT, INSERT                 ON public.message_envelopes TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments       TO coram_app;

GRANT SELECT, UPDATE, DELETE ON public.message_envelopes TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.attachments       TO coram_cron;

REVOKE ALL ON FUNCTION coram.in_channel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.in_channel(uuid) TO coram_app;

/*
 * Send: write the envelope, derived from the channel's TTL.
 *
 * The ciphertext is not a parameter. It never reaches Postgres at all — the
 * client hands it to ChannelDO, and this records only that something of about
 * this size was said here at about this time.
 */
CREATE FUNCTION coram.record_envelope(_channel_id uuid, _byte_length integer)
RETURNS TABLE (envelope_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tenant  uuid := coram.current_tenant_id();
  _ttl     integer;
  _sender  uuid;
  _bucket  integer;
  _id      uuid;
  _expires timestamptz;
BEGIN
  IF NOT coram.in_channel(_channel_id) THEN
    RAISE EXCEPTION 'coram: not a member of that channel' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT ttl_days INTO _ttl FROM public.channels
  WHERE id = _channel_id AND tenant_id = _tenant AND archived_at IS NULL;

  IF _ttl IS NULL THEN
    RAISE EXCEPTION 'coram: no such channel' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT m.id INTO _sender FROM public.memberships m
  WHERE m.user_id = coram.current_user_id() AND m.tenant_id = _tenant;

  -- Coarsened to 256-byte buckets. An exact length distinguishes "yes" from
  -- "no" in a two-message exchange; a bucket does not.
  _bucket := ((_byte_length / 256) + 1) * 256;
  _expires := now() + (_ttl || ' days')::interval;

  INSERT INTO public.message_envelopes
    (tenant_id, channel_id, sender_id, byte_length, expires_at)
  VALUES (_tenant, _channel_id, _sender, _bucket, _expires)
  RETURNING id INTO _id;

  RETURN QUERY SELECT _id, _expires;
END;
$$;

REVOKE ALL ON FUNCTION coram.record_envelope(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.record_envelope(uuid, integer) TO coram_app;

COMMIT;
