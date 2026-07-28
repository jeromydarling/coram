
-- ═══════════════════════════════════════════════════════════
-- CAREGIVER NETWORK — BUG FIX MIGRATION
-- ═══════════════════════════════════════════════════════════

-- #4: Prevent duplicate requests (one pending/accepted per pair)
CREATE UNIQUE INDEX idx_caregiver_requests_unique_active
  ON public.caregiver_network_requests (from_user_id, to_profile_id)
  WHERE status IN ('pending', 'accepted');

-- #5 + #6: Block re-requests after block + prevent self-requests
-- We need a function to check if blocked or self-request
CREATE OR REPLACE FUNCTION public.validate_caregiver_request()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE
  v_target_user_id uuid;
  v_blocked boolean;
BEGIN
  -- Get the user_id of the target profile
  SELECT user_id INTO v_target_user_id
  FROM caregiver_profiles WHERE id = NEW.to_profile_id;

  -- #6: Prevent self-request
  IF NEW.from_user_id = v_target_user_id THEN
    RAISE EXCEPTION 'Cannot send a request to yourself';
  END IF;

  -- #5: Prevent re-request after being blocked
  SELECT EXISTS (
    SELECT 1 FROM caregiver_network_requests
    WHERE from_user_id = NEW.from_user_id
      AND to_profile_id = NEW.to_profile_id
      AND status = 'blocked'
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'This connection is not available';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_caregiver_request
  BEFORE INSERT ON public.caregiver_network_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_caregiver_request();

-- #10: Prevent status regression (only valid forward transitions)
CREATE OR REPLACE FUNCTION public.validate_caregiver_request_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow: pending → accepted/declined/blocked
  -- No going backwards
  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined', 'blocked') THEN
    RETURN NEW;
  END IF;

  -- Allow accepted → blocked (for safety)
  IF OLD.status = 'accepted' AND NEW.status = 'blocked' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$;

CREATE TRIGGER trg_validate_request_transition
  BEFORE UPDATE OF status ON public.caregiver_network_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_caregiver_request_transition();

-- #9: Auto-update updated_at on caregiver_profiles
CREATE OR REPLACE FUNCTION public.update_caregiver_profile_timestamp()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_caregiver_profile_updated_at
  BEFORE UPDATE ON public.caregiver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_caregiver_profile_timestamp();
