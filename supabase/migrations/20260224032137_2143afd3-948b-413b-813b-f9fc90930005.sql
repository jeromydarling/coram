
-- ═══════════════════════════════════════════════
-- Founding Garden Program: tables + atomic RPC
-- ═══════════════════════════════════════════════

-- 1) Program definition (single-row control table)
CREATE TABLE public.founding_garden_program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL DEFAULT 'founding_garden_2026_launch',
  is_active boolean NOT NULL DEFAULT true,
  cap int NOT NULL DEFAULT 20,
  purchased_count int NOT NULL DEFAULT 0,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.founding_garden_program ENABLE ROW LEVEL SECURITY;

-- Only operator admins can read
CREATE POLICY "Operator admins can read founding_garden_program"
  ON public.founding_garden_program FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- Seed the program row
INSERT INTO public.founding_garden_program (key) VALUES ('founding_garden_2026_launch');

-- 2) Tenants columns (founding_garden_status already exists from prior migration, add new columns)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_founding_garden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_garden_joined_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS founding_garden_program_key text NULL;

-- 3) Audit events table
CREATE TABLE public.founding_garden_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  program_key text NOT NULL,
  event_type text NOT NULL,
  stripe_session_id text NULL,
  stripe_subscription_id text NULL,
  actor_user_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for event_type
CREATE OR REPLACE FUNCTION public.validate_founding_garden_event_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.event_type NOT IN (
    'checkout_started','checkout_completed','checkout_expired',
    'cap_reached','status_granted','status_denied'
  ) THEN
    RAISE EXCEPTION 'Invalid founding_garden_events event_type: %', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_founding_garden_event
  BEFORE INSERT OR UPDATE ON public.founding_garden_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_founding_garden_event_type();

ALTER TABLE public.founding_garden_events ENABLE ROW LEVEL SECURITY;

-- Only operator admins can read audit events
CREATE POLICY "Operator admins can read founding_garden_events"
  ON public.founding_garden_events FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- Service role inserts only (via edge functions)
CREATE POLICY "Service role inserts founding_garden_events"
  ON public.founding_garden_events FOR INSERT
  WITH CHECK (true);

-- 4) Atomic grant RPC — race-condition safe with FOR UPDATE lock
CREATE OR REPLACE FUNCTION public.grant_founding_garden_if_available(
  p_tenant_id uuid,
  p_program_key text,
  p_stripe_session_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_program founding_garden_program%ROWTYPE;
  v_already boolean;
  v_cap_reached boolean := false;
BEGIN
  -- Lock the program row to prevent race conditions
  SELECT * INTO v_program
  FROM founding_garden_program
  WHERE key = p_program_key
  FOR UPDATE;

  IF v_program.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'granted', false, 'reason', 'program_not_found');
  END IF;

  -- Check if tenant is already a founding member (idempotency)
  SELECT is_founding_garden INTO v_already
  FROM tenants WHERE id = p_tenant_id;

  IF v_already = true THEN
    -- Log but don't double-count
    INSERT INTO founding_garden_events (tenant_id, program_key, event_type, stripe_session_id, stripe_subscription_id)
    VALUES (p_tenant_id, p_program_key, 'checkout_completed', p_stripe_session_id, p_stripe_subscription_id);
    
    RETURN jsonb_build_object(
      'ok', true, 'granted', true, 'reason', 'already_member',
      'remaining', v_program.cap - v_program.purchased_count,
      'cap_reached', v_program.purchased_count >= v_program.cap
    );
  END IF;

  -- Check availability
  IF NOT v_program.is_active OR v_program.purchased_count >= v_program.cap THEN
    INSERT INTO founding_garden_events (tenant_id, program_key, event_type, stripe_session_id, stripe_subscription_id)
    VALUES (p_tenant_id, p_program_key, 'status_denied', p_stripe_session_id, p_stripe_subscription_id);
    
    RETURN jsonb_build_object(
      'ok', true, 'granted', false, 'reason', 'cap_reached',
      'remaining', GREATEST(0, v_program.cap - v_program.purchased_count),
      'cap_reached', true
    );
  END IF;

  -- Grant!
  UPDATE founding_garden_program
  SET purchased_count = purchased_count + 1,
      updated_at = now()
  WHERE id = v_program.id;

  -- Check if this was the last slot
  IF v_program.purchased_count + 1 >= v_program.cap THEN
    v_cap_reached := true;
    UPDATE founding_garden_program
    SET is_active = false, ends_at = now(), updated_at = now()
    WHERE id = v_program.id;
    
    INSERT INTO founding_garden_events (tenant_id, program_key, event_type)
    VALUES (p_tenant_id, p_program_key, 'cap_reached');
  END IF;

  -- Update tenant
  UPDATE tenants
  SET is_founding_garden = true,
      founding_garden_joined_at = now(),
      founding_garden_program_key = p_program_key,
      founding_garden_status = true
  WHERE id = p_tenant_id;

  -- Audit
  INSERT INTO founding_garden_events (tenant_id, program_key, event_type, stripe_session_id, stripe_subscription_id)
  VALUES (p_tenant_id, p_program_key, 'status_granted', p_stripe_session_id, p_stripe_subscription_id);

  RETURN jsonb_build_object(
    'ok', true, 'granted', true, 'reason', 'granted',
    'remaining', GREATEST(0, v_program.cap - v_program.purchased_count - 1),
    'cap_reached', v_cap_reached
  );
END;
$$;
