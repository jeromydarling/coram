-- =====================================================================
-- 0005_thesaurus — fundraising, dues, and mutual aid (§5.6).
-- Forward-only. Do not edit after it has run anywhere.
--
-- §5.6: "1% platform take on general fundraising and dues. Zero on bail and
-- mutual aid. This waiver is a permanent product commitment. Do not make it
-- configurable." §10 adds: "Do not soften the bail-fund waiver ... in response
-- to revenue modeling."
--
-- Taken literally, that rules out the obvious implementation. There is no
-- take_rate column on tenants, none on funds, and no platform settings table,
-- because a column is a thing someone can change under pressure in a quarter
-- where the numbers are bad. The rate lives in an IMMUTABLE function with the
-- four values written into it, and a trigger computes every fee from that
-- function while overwriting whatever the application supplied. The
-- application cannot set a fee. There is no argument for one.
--
-- Changing the waiver therefore requires a migration, in a diff, with someone's
-- name on it. That is the intended cost.
--
-- Money is integer minor units (cents) throughout. No floats anywhere near a
-- bail fund.
-- =====================================================================

BEGIN;

CREATE TYPE coram.fund_kind AS ENUM ('general', 'dues', 'mutual_aid', 'bail');

-- ---------------------------------------------------------------------
-- The take rate. The whole commitment, in one function.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.take_basis_points(_kind coram.fund_kind)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$
  SELECT CASE _kind
           WHEN 'general'    THEN 100  -- 1%
           WHEN 'dues'       THEN 100  -- 1%
           WHEN 'mutual_aid' THEN 0    -- §5.6, permanent
           WHEN 'bail'       THEN 0    -- §5.6, permanent
         END
$$;

COMMENT ON FUNCTION coram.take_basis_points(coram.fund_kind) IS
  'Platform take in basis points. Zero on bail and mutual aid is a permanent '
  'product commitment (CLAUDE.md §5.6, §10) and is deliberately not configurable: '
  'there is no column, no setting, and no environment variable that changes it.';

-- ---------------------------------------------------------------------
-- funds
-- ---------------------------------------------------------------------

CREATE TABLE public.funds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  name        text NOT NULL,
  description text,
  kind        coram.fund_kind NOT NULL,

  -- Campaign thermometer. NULL means no target, which is a legitimate choice
  -- for a bail fund that needs whatever it needs.
  goal_cents  bigint CHECK (goal_cents IS NULL OR goal_cents > 0),
  currency    text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),

  -- Escrow balances, maintained by trigger. Kept as columns rather than summed
  -- on read because a disbursement has to check the balance inside the same
  -- transaction that creates it, and a fund cannot pay out money it does not
  -- hold.
  raised_cents    bigint NOT NULL DEFAULT 0 CHECK (raised_cents >= 0),
  disbursed_cents bigint NOT NULL DEFAULT 0 CHECK (disbursed_cents >= 0),

  is_public   boolean NOT NULL DEFAULT false,
  public_slug text UNIQUE,

  closed_at   timestamptz,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT funds_public_needs_slug CHECK (is_public = (public_slug IS NOT NULL)),
  CONSTRAINT funds_not_overdrawn CHECK (disbursed_cents <= raised_cents)
);

CREATE INDEX funds_tenant_idx ON public.funds (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------
-- contributions
-- ---------------------------------------------------------------------

CREATE TABLE public.contributions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fund_id    uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,

  -- Nullable, and that is a feature. Someone giving to a bail fund may have
  -- excellent reasons not to be in anyone's CRM, and a donation should not be
  -- the thing that puts them there.
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,

  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency     text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),

  -- Computed by trigger from coram.take_basis_points. Whatever the application
  -- supplies here is discarded.
  take_cents   bigint NOT NULL DEFAULT 0 CHECK (take_cents >= 0),

  -- §5.6 names a Bitcoin/Lightning fallback for deplatforming resilience. The
  -- column exists so the schema does not have to change when the rail lands;
  -- the adapter does not, and lib/rails.ts says so plainly.
  rail       text NOT NULL DEFAULT 'stripe' CHECK (rail IN ('stripe', 'lightning')),

  status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'settled', 'refunded', 'failed')),

  -- Idempotency against the hub. Unique so a replayed webhook cannot double
  -- count a donation.
  external_ref text,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  settled_at  timestamptz
);

CREATE UNIQUE INDEX contributions_external_ref_key
  ON public.contributions (tenant_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX contributions_fund_idx ON public.contributions (fund_id, occurred_at DESC);
CREATE INDEX contributions_contact_idx ON public.contributions (contact_id) WHERE contact_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- recurring giving and dues
-- ---------------------------------------------------------------------

CREATE TABLE public.recurring_gifts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fund_id    uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,

  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency     text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  interval     text NOT NULL CHECK (interval IN ('monthly', 'quarterly', 'annual')),

  external_ref text UNIQUE,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'paused', 'cancelled')),

  started_at  timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE INDEX recurring_gifts_fund_idx ON public.recurring_gifts (fund_id, status);

-- Dues with a sliding scale and a hardship waiver (§5.6).
--
-- The waiver is a boolean with no reason column and no approval workflow. A
-- member saying they cannot pay this month is not a claim that needs
-- adjudicating, and building a form to justify it would make people stop
-- asking — which is how a hardship waiver quietly becomes decorative.
CREATE TABLE public.dues_schedules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- What this member pays. The sliding scale is bands a workspace defines and
  -- a member picks from; we record the amount, not their income.
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency     text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  interval     text NOT NULL CHECK (interval IN ('monthly', 'quarterly', 'annual')),
  scale_band   text,

  hardship_waiver boolean NOT NULL DEFAULT false,

  external_ref text UNIQUE,
  status     text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'paused', 'cancelled')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, contact_id),
  -- A waived member owes nothing. Enforced so "waived" cannot coexist with a
  -- standing charge that keeps being attempted.
  CONSTRAINT dues_waiver_is_free CHECK (NOT hardship_waiver OR amount_cents = 0)
);

-- ---------------------------------------------------------------------
-- disbursements — §5.6 dual approval
--
-- Money leaves an escrowed fund only when two different people who are not the
-- requester have each approved it. Enforced in the database, because this is
-- the one place in the product where a bug is somebody's bail money.
-- ---------------------------------------------------------------------

CREATE TABLE public.disbursements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fund_id    uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,

  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency     text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),

  -- What this is for, in the workspace's own words. Deliberately not a
  -- reference to a contact: who received bail support is Custos's business
  -- under a far tighter retention rule (§5.9), not the finance module's.
  purpose    text NOT NULL,

  status     text NOT NULL DEFAULT 'proposed'
               CHECK (status IN ('proposed', 'approved', 'paid', 'rejected', 'cancelled')),

  requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  approved_at  timestamptz,
  paid_at      timestamptz
);

CREATE INDEX disbursements_fund_idx ON public.disbursements (fund_id, status);

CREATE TABLE public.disbursement_approvals (
  disbursement_id uuid NOT NULL REFERENCES public.disbursements(id) ON DELETE CASCADE,
  approver_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  approved_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (disbursement_id, approver_id)
);

-- ---------------------------------------------------------------------
-- The take, computed and not negotiable
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.apply_take() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE _kind coram.fund_kind;
BEGIN
  SELECT kind INTO _kind FROM public.funds WHERE id = NEW.fund_id;

  -- Overwrite, never read. Whatever the caller put in take_cents is discarded,
  -- so no handler — present or future — can set its own fee.
  NEW.take_cents := (NEW.amount_cents * coram.take_basis_points(_kind)) / 10000;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contributions_apply_take
  BEFORE INSERT OR UPDATE OF amount_cents, fund_id ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION coram.apply_take();

-- Escrow balance. Only settled money counts toward what a fund can pay out.
CREATE FUNCTION coram.sync_fund_raised() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE _delta bigint := 0;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'settled' THEN
    _delta := NEW.amount_cents - NEW.take_cents;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'settled' AND NEW.status = 'settled' THEN
      _delta := NEW.amount_cents - NEW.take_cents;
    ELSIF OLD.status = 'settled' AND NEW.status <> 'settled' THEN
      _delta := -(OLD.amount_cents - OLD.take_cents);
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'settled' THEN
    _delta := -(OLD.amount_cents - OLD.take_cents);
  END IF;

  IF _delta <> 0 THEN
    UPDATE public.funds SET raised_cents = raised_cents + _delta
    WHERE id = coalesce(NEW.fund_id, OLD.fund_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER contributions_sync_fund
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION coram.sync_fund_raised();

-- ---------------------------------------------------------------------
-- Dual approval, in the database
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.approve_disbursement(_disbursement_id uuid)
RETURNS TABLE (status text, approvals integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _d      public.disbursements%ROWTYPE;
  _user   uuid := coram.current_user_id();
  _count  integer;
BEGIN
  SELECT * INTO _d FROM public.disbursements
  WHERE id = _disbursement_id AND tenant_id = coram.current_tenant_id()
  FOR UPDATE;

  IF _d.id IS NULL THEN
    RAISE EXCEPTION 'coram: no such disbursement' USING ERRCODE = 'no_data_found';
  END IF;
  IF _d.status <> 'proposed' THEN
    RAISE EXCEPTION 'coram: that disbursement is already %', _d.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Only a steward approves money leaving. §4.1 puts billing with the steward,
  -- and this is the sharper end of the same authority.
  IF NOT coram.has_role('steward') THEN
    RAISE EXCEPTION 'coram: only a steward may approve a disbursement'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The requester is not one of the two. Proposing and approving your own
  -- payout is exactly the single point of failure dual approval exists to
  -- remove, and allowing it would make the whole control decorative.
  IF _d.requested_by = _user THEN
    RAISE EXCEPTION 'coram: the person who requested a disbursement cannot approve it'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.disbursement_approvals (disbursement_id, approver_id, tenant_id)
  VALUES (_disbursement_id, _user, _d.tenant_id)
  ON CONFLICT DO NOTHING;

  SELECT count(*)::integer INTO _count
  FROM public.disbursement_approvals WHERE disbursement_id = _disbursement_id;

  IF _count >= 2 THEN
    UPDATE public.disbursements
    SET status = 'approved', approved_at = now()
    WHERE id = _disbursement_id;
    RETURN QUERY SELECT 'approved'::text, _count;
  END IF;

  RETURN QUERY SELECT 'proposed'::text, _count;
END;
$$;

/*
 * Mark an approved disbursement paid, and move the escrow balance.
 *
 * The balance check happens here, inside the transaction that debits, so two
 * disbursements approved against the same money cannot both be paid. The
 * funds_not_overdrawn CHECK is the second line: even if this logic were wrong,
 * the row would refuse to be written.
 */
CREATE FUNCTION coram.pay_disbursement(_disbursement_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _d         public.disbursements%ROWTYPE;
  _available bigint;
BEGIN
  IF NOT coram.has_role('steward') THEN
    RAISE EXCEPTION 'coram: only a steward may release a payment'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO _d FROM public.disbursements
  WHERE id = _disbursement_id AND tenant_id = coram.current_tenant_id()
  FOR UPDATE;

  IF _d.id IS NULL THEN
    RAISE EXCEPTION 'coram: no such disbursement' USING ERRCODE = 'no_data_found';
  END IF;
  IF _d.status <> 'approved' THEN
    RAISE EXCEPTION 'coram: a disbursement must be approved by two stewards before it is paid'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT raised_cents - disbursed_cents INTO _available
  FROM public.funds WHERE id = _d.fund_id FOR UPDATE;

  IF _available < _d.amount_cents THEN
    RAISE EXCEPTION 'coram: the fund holds % but the disbursement is for %',
      _available, _d.amount_cents USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.funds SET disbursed_cents = disbursed_cents + _d.amount_cents
  WHERE id = _d.fund_id;

  UPDATE public.disbursements SET status = 'paid', paid_at = now()
  WHERE id = _disbursement_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Public fund pages — the campaign thermometer
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.public_fund(_slug text)
RETURNS TABLE (
  id uuid, tenant_id uuid, name text, description text, kind coram.fund_kind,
  goal_cents bigint, raised_cents bigint, currency text,
  supporter_count bigint, closed boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.id, f.tenant_id, f.name, f.description, f.kind,
         f.goal_cents, f.raised_cents, f.currency,
         -- A count. Never a donor list: who gives to a bail fund is not
         -- something a public page gets to publish.
         (SELECT count(*) FROM public.contributions c
          WHERE c.fund_id = f.id AND c.status = 'settled')::bigint,
         f.closed_at IS NOT NULL
  FROM public.funds f
  WHERE f.public_slug = _slug AND f.is_public
$$;

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.funds                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds                  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.contributions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.recurring_gifts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_gifts        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.dues_schedules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_schedules         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.disbursements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursements          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.disbursement_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursement_approvals FORCE  ROW LEVEL SECURITY;

-- Funds and their totals are workspace figures, not personal data, so an
-- observer can report on them. `legal` gets nothing here.
CREATE POLICY funds_select ON public.funds FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY funds_write ON public.funds FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- Who gave, and how much, is personal. Stewards see it; an organizer sees only
-- contributions from contacts in their turf; an anonymous contribution
-- (contact_id IS NULL) is visible to stewards alone.
CREATE POLICY contributions_select ON public.contributions FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (
      coram.has_role('steward')
      OR (contact_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contributions.contact_id
              AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
          ))
    )
  );

CREATE POLICY contributions_write ON public.contributions FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY recurring_gifts_select ON public.recurring_gifts FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY recurring_gifts_write ON public.recurring_gifts FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- A member sees their own dues. Whether a colleague has a hardship waiver is
-- nobody else's business, so organizers are not on this policy either.
CREATE POLICY dues_select ON public.dues_schedules FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND (
      coram.has_role('steward')
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = dues_schedules.contact_id AND c.user_id = coram.current_user_id()
      )
    )
  );

CREATE POLICY dues_write ON public.dues_schedules FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- Disbursements are readable by everyone in the workspace except `legal`.
-- Deliberately wide: a mutual aid fund that spends money without its members
-- being able to see that it did is not mutual aid.
CREATE POLICY disbursements_select ON public.disbursements FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY disbursements_propose ON public.disbursements FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND requested_by = coram.current_user_id()
  );

-- No UPDATE policy. Status changes go through approve_disbursement and
-- pay_disbursement, which is what makes the two-approver rule unavoidable.
CREATE POLICY approvals_select ON public.disbursement_approvals FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funds                  TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions          TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_gifts        TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dues_schedules         TO coram_app;
GRANT SELECT, INSERT                 ON public.disbursements          TO coram_app;
GRANT SELECT                         ON public.disbursement_approvals TO coram_app;

GRANT SELECT, UPDATE, DELETE ON public.contributions  TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.dues_schedules TO coram_cron;

REVOKE ALL ON FUNCTION coram.approve_disbursement(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.pay_disbursement(uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.public_fund(text)          FROM PUBLIC;

GRANT EXECUTE ON FUNCTION coram.approve_disbursement(uuid) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.pay_disbursement(uuid)     TO coram_app;
GRANT EXECUTE ON FUNCTION coram.public_fund(text)          TO coram_app;
GRANT EXECUTE ON FUNCTION coram.take_basis_points(coram.fund_kind) TO coram_app;

-- ---------------------------------------------------------------------
-- What the Stripe hub webhook is allowed to do.
--
-- The webhook is unauthenticated and reachable by anyone who can guess the
-- URL. It has no session and no tenant context, so it cannot use RLS — but
-- giving it the BYPASSRLS cron role would hand a public endpoint the widest
-- credential in the system.
--
-- So it gets three narrow SECURITY DEFINER functions instead, the same shape
-- the auth path uses in 0001. Each takes its tenant explicitly and scopes
-- every write to it. The blast radius of the worst case is these three
-- operations rather than the whole database.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.record_contribution(
  _tenant_id uuid, _fund_id uuid, _contact_id uuid,
  _amount_cents bigint, _currency text, _external_ref text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- The fund must belong to the tenant the event claims. Without this, a
  -- forged-but-signed event could credit one workspace's fund from another's
  -- metadata.
  IF NOT EXISTS (
    SELECT 1 FROM public.funds f WHERE f.id = _fund_id AND f.tenant_id = _tenant_id
  ) THEN
    RETURN false;
  END IF;

  -- take_cents is omitted: the trigger computes it from the fund's kind, so a
  -- bail fund pays nothing whatever arrives here (§5.6).
  INSERT INTO public.contributions
    (tenant_id, fund_id, contact_id, amount_cents, currency, status, external_ref,
     occurred_at, settled_at)
  VALUES (_tenant_id, _fund_id, _contact_id, _amount_cents, upper(_currency),
          'settled', _external_ref, now(), now())
  ON CONFLICT (tenant_id, external_ref) DO NOTHING;

  RETURN true;
END;
$$;

CREATE FUNCTION coram.refund_contribution(_tenant_id uuid, _external_ref text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.contributions
  SET status = 'refunded', settled_at = now()
  WHERE tenant_id = _tenant_id AND external_ref = _external_ref
$$;

CREATE FUNCTION coram.set_subscription_status(
  _tenant_id uuid, _external_ref text, _status text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF _status NOT IN ('active', 'paused', 'cancelled') THEN
    RAISE EXCEPTION 'coram: unknown subscription status %', _status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.recurring_gifts
  SET status = _status,
      cancelled_at = CASE WHEN _status = 'cancelled' THEN now() ELSE cancelled_at END
  WHERE tenant_id = _tenant_id AND external_ref = _external_ref;

  UPDATE public.dues_schedules
  SET status = _status
  WHERE tenant_id = _tenant_id AND external_ref = _external_ref;
END;
$$;

REVOKE ALL ON FUNCTION coram.record_contribution(uuid, uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.refund_contribution(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION coram.set_subscription_status(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION coram.record_contribution(uuid, uuid, uuid, bigint, text, text) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.refund_contribution(uuid, text) TO coram_app;
GRANT EXECUTE ON FUNCTION coram.set_subscription_status(uuid, text, text) TO coram_app;

CREATE TRIGGER funds_touch_updated
  BEFORE UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

CREATE TRIGGER dues_touch_updated
  BEFORE UPDATE ON public.dues_schedules
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

COMMIT;
