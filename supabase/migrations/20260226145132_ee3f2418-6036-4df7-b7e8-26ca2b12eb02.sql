
-- 1) Last-steward protection: prevent removing the only steward from a tenant
CREATE OR REPLACE FUNCTION public.remove_tenant_user(p_tenant_id uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_steward boolean;
  v_steward_count integer;
BEGIN
  -- Verify caller is steward of this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users tu
    JOIN user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = p_tenant_id
      AND ur.role = 'steward'
  ) THEN
    RAISE EXCEPTION 'Only stewards can remove users';
  END IF;

  -- Check if target is a steward
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_target_user_id AND role = 'steward'
  ) INTO v_is_steward;

  IF v_is_steward THEN
    -- Count stewards in tenant
    SELECT count(*) INTO v_steward_count
    FROM tenant_users tu
    JOIN user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.tenant_id = p_tenant_id AND ur.role = 'steward';

    IF v_steward_count <= 1 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'last_steward',
        'message', 'Cannot remove the only steward. Assign another steward first.');
    END IF;
  END IF;

  DELETE FROM tenant_users WHERE tenant_id = p_tenant_id AND user_id = p_target_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 2) Leave-org RPC (voluntary)
CREATE OR REPLACE FUNCTION public.leave_tenant(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_steward boolean;
  v_steward_count integer;
BEGIN
  -- Verify caller belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
  END IF;

  -- If caller is steward, check they aren't the last one
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'steward'
  ) INTO v_is_steward;

  IF v_is_steward THEN
    SELECT count(*) INTO v_steward_count
    FROM tenant_users tu
    JOIN user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.tenant_id = p_tenant_id AND ur.role = 'steward';

    IF v_steward_count <= 1 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'last_steward',
        'message', 'You are the only steward. Assign another steward before leaving.');
    END IF;
  END IF;

  DELETE FROM tenant_users WHERE tenant_id = p_tenant_id AND user_id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3) Update bulk_create_invites to also skip existing tenant members
CREATE OR REPLACE FUNCTION public.bulk_create_invites(p_tenant_id uuid, p_invites jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_created integer := 0;
  v_skipped integer := 0;
  v_already_member integer := 0;
  v_item jsonb;
  v_email text;
  v_role text;
BEGIN
  -- Verify caller is steward of this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users tu
    JOIN user_roles ur ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = p_tenant_id
      AND ur.role = 'steward'
  ) THEN
    RAISE EXCEPTION 'Only stewards can create invites';
  END IF;
  
  v_count := jsonb_array_length(p_invites);
  IF v_count > 50 THEN
    RAISE EXCEPTION 'Maximum 50 invites per batch';
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_invites)
  LOOP
    v_email := lower(trim(v_item->>'email'));
    v_role := COALESCE(v_item->>'ministry_role', 'visitor');
    
    IF v_email IS NULL OR v_email = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    -- Skip if already a tenant member
    IF EXISTS (
      SELECT 1 FROM tenant_users tu
      JOIN auth.users au ON au.id = tu.user_id
      WHERE tu.tenant_id = p_tenant_id AND au.email = v_email
    ) THEN
      v_already_member := v_already_member + 1;
      CONTINUE;
    END IF;
    
    -- Skip if already an active invite
    IF EXISTS (
      SELECT 1 FROM tenant_invites
      WHERE tenant_id = p_tenant_id AND email = v_email
        AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    -- Upsert invite (replace expired/revoked)
    INSERT INTO tenant_invites (tenant_id, invited_by, email, ministry_role)
    VALUES (p_tenant_id, auth.uid(), v_email, v_role)
    ON CONFLICT (tenant_id, email) DO UPDATE
    SET token = encode(gen_random_bytes(32), 'hex'),
        ministry_role = v_role,
        invited_by = auth.uid(),
        expires_at = now() + interval '30 days',
        accepted_at = NULL,
        revoked_at = NULL,
        created_at = now();
    
    v_created := v_created + 1;
  END LOOP;
  
  RETURN jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped, 'already_member', v_already_member);
END;
$$;

-- 4) Scheduled cleanup for expired invites (add to pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM tenant_invites
  WHERE expires_at < now() - interval '30 days'
    AND accepted_at IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
END;
$$;

-- Schedule it at 4:30 AM UTC (after other maintenance)
SELECT cron.schedule('cleanup-expired-invites', '30 4 * * *', $$ SELECT public.cleanup_expired_invites(); $$);
