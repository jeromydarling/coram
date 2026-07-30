-- ---------------------------------------------------------------------
-- 0016 — joining an open channel
--
-- 0008 wrote channel_members_write as "you may add people to a room you are
-- already in", which is right for inviting a colleague and wrong for the one
-- case it also has to cover: joining a channel yourself. Under that policy the
-- INSERT that would put you in the room requires you to already be in it.
--
-- Relaxing the policy is the obvious fix and the wrong one. `in_channel` is the
-- only key to a room, and a policy loose enough to let you add yourself to a
-- named channel is also loose enough to let you add yourself to somebody
-- else's DM. There is no steward override in this module by design — paying for
-- the workspace does not put you in the room — and a widened INSERT policy
-- would be exactly that override, arrived at sideways.
--
-- So: a narrow SECURITY DEFINER function that admits named channels only,
-- never DMs, never an archived room, and only inside the caller's own tenant.
-- It is the same pattern 0015 used for attendance counts — where RLS cannot
-- express the rule, a function that does one thing and returns a scalar.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.join_channel(_channel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _tenant uuid := coram.current_tenant_id();
  _member uuid;
  _kind   text;
BEGIN
  -- Named channels only. A DM has exactly two people in it and joining one
  -- uninvited is the whole thing this function exists to make impossible.
  SELECT kind INTO _kind
  FROM public.channels
  WHERE id = _channel_id AND tenant_id = _tenant AND archived_at IS NULL;

  IF _kind IS DISTINCT FROM 'channel' THEN
    RETURN false;
  END IF;

  -- Observers and legal accounts cannot open channels (channels_insert), and
  -- they should not be able to walk into one either.
  IF coram.has_role('observer', 'legal') THEN
    RETURN false;
  END IF;

  SELECT m.id INTO _member
  FROM public.memberships m
  WHERE m.user_id = coram.current_user_id() AND m.tenant_id = _tenant;

  IF _member IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.channel_members (channel_id, membership_id, tenant_id)
  VALUES (_channel_id, _member, _tenant)
  ON CONFLICT (channel_id, membership_id) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION coram.join_channel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.join_channel(uuid) TO coram_app;
