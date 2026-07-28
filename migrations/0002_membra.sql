-- =====================================================================
-- 0002_membra — the supporter CRM. The spine every other module writes to.
-- Forward-only. Do not edit after it has run anywhere.
--
-- This migration is where the five roles in §4.1 stop being a table in a
-- document and start being enforced:
--
--   steward    every contact in the workspace
--   organizer  contacts inside an assigned turf, and nothing outside it
--   member     their own record only
--   observer   no individual contact rows at all — aggregates only
--   legal      no CRM access whatsoever
--
-- observer and legal get no SELECT policy on public.contacts. Not a narrow
-- one — none. Under default-deny that is a hard denial, and it is the reason
-- observers read aggregates through a SECURITY DEFINER function that returns
-- counts and never rows.
--
-- Note also what §4.1's "organizer cannot export globally" costs here:
-- nothing. There is no separate export permission, because an organizer's
-- SELECT is already turf-bounded. A global export by an organizer returns
-- their turf and no more, without any code in the export route deciding that.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Turf.
--
-- §3.1: turf is a polygon assignment, not a location history. There is no
-- GPS trail table and never will be. A turf is a named area an organizer is
-- responsible for; a contact belongs to at most one.
--
-- The boundary is stored as GeoJSON text rather than PostGIS geometry. That
-- is a deliberate deferral: PostGIS would let us answer "which turf contains
-- this address", which needs a geocoder, which means sending member addresses
-- to a third party. Until §5.2 settles how that happens without leaking
-- addresses, turf assignment is manual and the boundary is for drawing only.
-- ---------------------------------------------------------------------

CREATE TABLE public.turfs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  boundary   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- ---------------------------------------------------------------------
-- Contacts.
--
-- Read the absences here as carefully as the columns. There is no date of
-- birth, no gender, no employer, no household income, no "notes" text column,
-- no last-seen IP, no device id. §3 rule 4: if a field is not required to
-- deliver a shipped feature, it does not exist.
--
-- postal_code is the coarsest location we hold. It is here because Petitio
-- (§5.5) cannot look up a legislator without it and Convocare cannot tell
-- someone which events are near them. A full street address is not stored,
-- and §3.7 forbids anything finer permanently.
-- ---------------------------------------------------------------------

CREATE TABLE public.contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Null until an organizer assigns one. An unassigned contact is visible to
  -- stewards only, which is the safe default: it is better for a contact to
  -- be invisible to an organizer than visible to the wrong one.
  turf_id     uuid REFERENCES public.turfs(id) ON DELETE SET NULL,

  -- Set when this contact is also someone with a login, so `member` can reach
  -- their own record. Most contacts never have one.
  user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,

  display_name text NOT NULL,
  email        text,
  phone        text,
  postal_code  text,

  -- Tenant-defined fields, shaped by custom_field_defs. jsonb rather than EAV
  -- because these are read whole, per contact, and never queried across
  -- tenants.
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Last *explicitly logged* interaction — a conversation an organizer
  -- recorded, an event someone checked into. Deliberately not a passive
  -- signal: no open tracking, no click tracking, no page views feed this.
  -- See docs/engagement.md for why that line is where it is.
  last_interaction_at timestamptz,

  -- Set when the row arrived through an import, so the whole batch can be
  -- rolled back (§5.1). Null for contacts added by hand.
  import_batch_id uuid,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- A contact with no way to reach them and no name is not a contact.
  CONSTRAINT contacts_reachable CHECK (
    display_name <> '' OR email IS NOT NULL OR phone IS NOT NULL
  )
);

CREATE INDEX contacts_tenant_idx      ON public.contacts (tenant_id);
CREATE INDEX contacts_turf_idx        ON public.contacts (tenant_id, turf_id);
CREATE INDEX contacts_user_idx        ON public.contacts (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX contacts_import_idx      ON public.contacts (import_batch_id) WHERE import_batch_id IS NOT NULL;

-- Deduplication (§5.1). Case-insensitive, per tenant, and partial so the many
-- contacts with no email do not collide with each other on NULL.
CREATE UNIQUE INDEX contacts_tenant_email_key
  ON public.contacts (tenant_id, lower(email)) WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------

CREATE TABLE public.tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE public.contact_tags (
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  -- Join tables carry a timestamp too. Not for its own sake: the retention
  -- registry requires every table to name a column the sweep can measure age
  -- against, and a join table with no timestamp would have to be special-cased
  -- out of that rule. One column is cheaper than an exception.
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX contact_tags_tag_idx ON public.contact_tags (tag_id);

-- ---------------------------------------------------------------------
-- Custom field definitions and saved segments
-- ---------------------------------------------------------------------

CREATE TABLE public.custom_field_defs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key        text NOT NULL,
  label      text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'select')),
  options    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

-- A saved segment is a stored filter, not a stored result. Materializing the
-- membership would mean a second copy of who is in a list, ageing out of step
-- with the contacts themselves.
CREATE TABLE public.segments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  definition jsonb NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- ---------------------------------------------------------------------
-- Consent ledger (§5.1)
--
-- How each contact was acquired and what they opted into. Append-only: a
-- consent record is evidence, and evidence that can be edited is not evidence.
-- Withdrawal is a new row with granted = false, never an update of the old one.
-- ---------------------------------------------------------------------

CREATE TABLE public.consent_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'post', 'any')),
  granted     boolean NOT NULL,
  -- How we came to have them: 'signup_form', 'event_checkin', 'import',
  -- 'canvass', 'petition'. Free text so a tenant can be specific about a
  -- provenance we did not anticipate.
  acquisition text NOT NULL,
  note        text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX consent_records_contact_idx ON public.consent_records (contact_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- Encrypted notes — §3.3, "the single most important architectural
-- decision in the product".
--
-- The server stores ciphertext and cannot decrypt it. The key is derived from
-- the steward's passphrase in the browser and never leaves it. There is
-- deliberately no plaintext column, no search index, and no "recovery" path:
-- if the passphrase is lost the notes are gone, and that is the feature.
--
-- What the server can see: which contact has notes, how many, how long they
-- are, and when they were written. That is unavoidable metadata and it is
-- worth stating plainly rather than implying the row is opaque.
-- ---------------------------------------------------------------------

CREATE TABLE public.contact_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- AES-GCM output and its nonce, both base64. The server never parses these.
  ciphertext text NOT NULL,
  nonce      text NOT NULL,

  -- Which vault key this was sealed with, so rotation can re-wrap rather than
  -- orphan. Matches vault_keys.id.
  key_id     uuid NOT NULL,

  author_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_notes_contact_idx ON public.contact_notes (contact_id, created_at DESC);

-- The wrapped data-encryption key. The workspace's notes are all sealed with
-- one DEK; the DEK itself is stored wrapped by a key derived from the
-- steward's passphrase (PBKDF2 in the browser). The server holds the wrapped
-- blob and the KDF parameters, and can do nothing with either.
--
-- Rotating a passphrase re-wraps this one small blob. It does not touch a
-- single note.
CREATE TABLE public.vault_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  wrapped_dek  text NOT NULL,
  wrap_nonce   text NOT NULL,
  kdf_salt     text NOT NULL,
  kdf_iterations integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  retired_at   timestamptz
);

CREATE INDEX vault_keys_tenant_idx ON public.vault_keys (tenant_id) WHERE retired_at IS NULL;

-- ---------------------------------------------------------------------
-- Import batches (§5.1) — dry-run preview, commit, rollback
-- ---------------------------------------------------------------------

CREATE TABLE public.import_batches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- What the organizer called it. Not the uploaded file's name — that often
  -- carries a person's name or an organization's internal reference.
  label       text NOT NULL,
  status      text NOT NULL DEFAULT 'previewed'
                CHECK (status IN ('previewed', 'committed', 'rolled_back')),
  row_count   integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);

CREATE INDEX import_batches_tenant_idx ON public.import_batches (tenant_id, created_at DESC);

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_import_batch_fkey
  FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Default deny on everything above
-- ---------------------------------------------------------------------

ALTER TABLE public.turfs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turfs             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags              FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_defs FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.segments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.consent_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.vault_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_keys        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.import_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches    FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- The contact visibility predicate.
--
-- One function, used by every policy that touches contact data, so the rule
-- lives in exactly one place. A change to who can see a contact is a change
-- to this function and nothing else.
--
-- Note that `observer` and `legal` appear nowhere in it. They fall through to
-- false, which under default-deny means denied.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.can_see_contact(_tenant_id uuid, _turf_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE SET search_path = ''
AS $$
  SELECT _tenant_id = coram.current_tenant_id()
     AND CASE coram.current_role()
           WHEN 'steward'   THEN true
           -- Turf-bounded. An unassigned contact (turf_id IS NULL) is
           -- deliberately excluded: no organizer owns it yet.
           WHEN 'organizer' THEN _turf_id IS NOT NULL
                             AND _turf_id = ANY(coram.current_turf_ids())
           WHEN 'member'    THEN _user_id IS NOT NULL
                             AND _user_id = coram.current_user_id()
           ELSE false
         END
$$;

-- contacts ------------------------------------------------------------

CREATE POLICY contacts_select ON public.contacts FOR SELECT TO coram_app
  USING (coram.can_see_contact(tenant_id, turf_id, user_id));

-- Writes are stewards and organizers only. A member may read their own record
-- but not rewrite it — self-service edits go through a request the workspace
-- approves, which arrives with the member portal.
CREATE POLICY contacts_insert ON public.contacts FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    -- An organizer may only file a contact into a turf they hold, so they
    -- cannot create a row they would then be unable to see.
    AND (coram.has_role('steward') OR turf_id = ANY(coram.current_turf_ids()))
    AND coram.within_contact_limit(tenant_id)
  );

CREATE POLICY contacts_update ON public.contacts FOR UPDATE TO coram_app
  USING (coram.can_see_contact(tenant_id, turf_id, user_id) AND coram.has_role('steward', 'organizer'))
  WITH CHECK (coram.can_see_contact(tenant_id, turf_id, user_id));

CREATE POLICY contacts_delete ON public.contacts FOR DELETE TO coram_app
  USING (coram.can_see_contact(tenant_id, turf_id, user_id) AND coram.has_role('steward', 'organizer'));

-- turfs ---------------------------------------------------------------

CREATE POLICY turfs_select ON public.turfs FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY turfs_write ON public.turfs FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- tags ----------------------------------------------------------------

-- Tag names are workspace vocabulary, not contact data, so an observer may
-- read them — they need the labels to make sense of an aggregate. `legal` may
-- not, because tag names in a CRM routinely leak who is in the CRM.
CREATE POLICY tags_select ON public.tags FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY tags_write ON public.tags FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

-- contact_tags --------------------------------------------------------

-- Which contact carries which tag is contact data, so this follows the
-- contact predicate exactly rather than the looser tags rule above.
CREATE POLICY contact_tags_select ON public.contact_tags FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY contact_tags_write ON public.contact_tags FOR ALL TO coram_app
  USING (
    coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_tags.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  )
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_tags.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

-- custom_field_defs ---------------------------------------------------

CREATE POLICY custom_field_defs_select ON public.custom_field_defs FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY custom_field_defs_write ON public.custom_field_defs FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- segments ------------------------------------------------------------

-- A segment definition can encode "everyone tagged X in postal code Y", which
-- describes people even without naming them. Stewards and organizers only.
CREATE POLICY segments_select ON public.segments FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY segments_write ON public.segments FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

-- consent_records -----------------------------------------------------

CREATE POLICY consent_records_select ON public.consent_records FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = consent_records.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

-- Append-only: INSERT is granted, UPDATE and DELETE are not. Withdrawing
-- consent adds a row; it never rewrites one.
CREATE POLICY consent_records_insert ON public.consent_records FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = consent_records.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

-- contact_notes -------------------------------------------------------

-- The rows are ciphertext, but who has notes and how many is itself telling,
-- so visibility follows the contact predicate like everything else.
CREATE POLICY contact_notes_select ON public.contact_notes FOR SELECT TO coram_app
  USING (
    coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

CREATE POLICY contact_notes_insert ON public.contact_notes FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

CREATE POLICY contact_notes_delete ON public.contact_notes FOR DELETE TO coram_app
  USING (
    coram.has_role('steward', 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
    )
  );

-- vault_keys ----------------------------------------------------------

-- Readable by anyone who might hold the passphrase, because the wrapped DEK is
-- useless without it. Only a steward may create or retire one (§4.1 puts key
-- rotation with the steward).
CREATE POLICY vault_keys_select ON public.vault_keys FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY vault_keys_write ON public.vault_keys FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- import_batches ------------------------------------------------------

CREATE POLICY import_batches_select ON public.import_batches FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY import_batches_write ON public.import_batches FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts          TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turfs             TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags              TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_tags      TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_defs TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments          TO coram_app;
GRANT SELECT, INSERT                 ON public.consent_records   TO coram_app;
GRANT SELECT, INSERT, DELETE         ON public.contact_notes     TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_keys        TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches    TO coram_app;

GRANT SELECT, UPDATE, DELETE ON public.contacts        TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.consent_records TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.contact_notes   TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.import_batches  TO coram_cron;

-- ---------------------------------------------------------------------
-- The contact gate (§6)
--
-- Free under 250 contacts, and the free tier is contact-gated, never
-- feature-gated. Downgrading freezes new contact creation; it never deletes
-- (§6). So this blocks INSERT and touches nothing that already exists.
--
-- It runs inside the contacts_insert policy rather than as a trigger so that
-- hitting the ceiling is a row the policy declines, not an exception halfway
-- through a batch import.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.contact_limit_for(_tier coram.tier) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$
  SELECT CASE _tier
           WHEN 'parish'     THEN 250
           WHEN 'local'      THEN 2500
           -- Coalition and federation are priced on chapters, not contacts.
           ELSE 9223372036854775807
         END
$$;

CREATE FUNCTION coram.within_contact_limit(_tenant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.contact_count < coram.contact_limit_for(t.tier)
  FROM public.tenants t
  WHERE t.id = _tenant_id
$$;

REVOKE ALL ON FUNCTION coram.within_contact_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.within_contact_limit(uuid) TO coram_app;

-- tenants.contact_count is the number the gate reads, so it has to be exact.
-- A trigger keeps it so, rather than a periodic recount that would let a
-- workspace drift over its ceiling between runs.
CREATE FUNCTION coram.sync_contact_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tenants SET contact_count = contact_count + 1 WHERE id = NEW.tenant_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tenants SET contact_count = greatest(0, contact_count - 1) WHERE id = OLD.tenant_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER contacts_count_sync
  AFTER INSERT OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION coram.sync_contact_count();

CREATE FUNCTION coram.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contacts_touch_updated
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

-- ---------------------------------------------------------------------
-- Observer aggregates.
--
-- §4.1: an observer "sees no individual contact records". They still need
-- reporting, so this is the only door — it returns counts and never rows, and
-- it is the reason public.contacts has no observer SELECT policy.
--
-- SECURITY DEFINER, so it re-checks the caller's role itself rather than
-- trusting that it was called from the right place.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.contact_aggregates()
RETURNS TABLE (total bigint, with_email bigint, with_phone bigint, tagged bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tenant uuid := coram.current_tenant_id();
BEGIN
  IF _tenant IS NULL OR coram.current_role() = 'legal' THEN
    RAISE EXCEPTION 'coram: no aggregate access' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT count(*)::bigint,
         count(*) FILTER (WHERE c.email IS NOT NULL)::bigint,
         count(*) FILTER (WHERE c.phone IS NOT NULL)::bigint,
         count(DISTINCT ct.contact_id)::bigint
  FROM public.contacts c
  LEFT JOIN public.contact_tags ct ON ct.contact_id = c.id
  WHERE c.tenant_id = _tenant;
END;
$$;

REVOKE ALL ON FUNCTION coram.contact_aggregates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.contact_aggregates() TO coram_app;

-- ---------------------------------------------------------------------
-- Import rollback (§5.1)
--
-- Removes every contact a batch created and marks the batch rolled back.
-- Contacts the batch *updated* are not reverted — we do not keep the prior
-- values to revert to, and inventing them would be worse than declining.
-- The API says so plainly before asking for confirmation.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.rollback_import(_batch_id uuid)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tenant  uuid := coram.current_tenant_id();
  _removed bigint;
BEGIN
  IF _tenant IS NULL OR NOT coram.has_role('steward', 'organizer') THEN
    RAISE EXCEPTION 'coram: not permitted to roll back an import'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.import_batches b
    WHERE b.id = _batch_id AND b.tenant_id = _tenant AND b.status = 'committed'
  ) THEN
    RAISE EXCEPTION 'coram: no committed import batch by that id in this workspace'
      USING ERRCODE = 'no_data_found';
  END IF;

  DELETE FROM public.contacts
  WHERE import_batch_id = _batch_id AND tenant_id = _tenant;
  GET DIAGNOSTICS _removed = ROW_COUNT;

  UPDATE public.import_batches SET status = 'rolled_back' WHERE id = _batch_id;

  RETURN _removed;
END;
$$;

REVOKE ALL ON FUNCTION coram.rollback_import(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.rollback_import(uuid) TO coram_app;

COMMIT;
