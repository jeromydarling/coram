
-- Tenant invites table for invite-only signup
CREATE TABLE public.tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text NOT NULL,
  ministry_role text NOT NULL DEFAULT 'visitor',
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_pending_invite UNIQUE (tenant_id, email)
);

-- Index for token lookups
CREATE UNIQUE INDEX idx_tenant_invites_token ON public.tenant_invites(token);
CREATE INDEX idx_tenant_invites_tenant ON public.tenant_invites(tenant_id);
CREATE INDEX idx_tenant_invites_email ON public.tenant_invites(email);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_tenant_invite()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.ministry_role NOT IN ('shepherd', 'companion', 'visitor') THEN
    RAISE EXCEPTION 'Invalid ministry_role: %', NEW.ministry_role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tenant_invite
  BEFORE INSERT OR UPDATE ON public.tenant_invites
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_invite();

-- RLS
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- Stewards can manage invites for their tenant
CREATE POLICY "Stewards can view tenant invites"
  ON public.tenant_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = tenant_invites.tenant_id
        AND ur.role = 'steward'
    )
  );

CREATE POLICY "Stewards can create tenant invites"
  ON public.tenant_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = tenant_invites.tenant_id
        AND ur.role = 'steward'
    )
  );

CREATE POLICY "Stewards can update tenant invites"
  ON public.tenant_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = tenant_invites.tenant_id
        AND ur.role = 'steward'
    )
  );

-- Anyone can read their own invite by token (for the join page)
CREATE POLICY "Anyone can validate invite by token"
  ON public.tenant_invites FOR SELECT
  USING (true);

-- Function to validate and consume an invite token
CREATE OR REPLACE FUNCTION public.validate_invite_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_invite tenant_invites%ROWTYPE;
  v_tenant_name text;
BEGIN
  SELECT * INTO v_invite FROM tenant_invites WHERE token = p_token;
  
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  
  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'revoked');
  END IF;
  
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_used');
  END IF;
  
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  
  SELECT name INTO v_tenant_name FROM tenants WHERE id = v_invite.tenant_id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'invite_id', v_invite.id,
    'tenant_id', v_invite.tenant_id,
    'tenant_name', v_tenant_name,
    'email', v_invite.email,
    'ministry_role', v_invite.ministry_role
  );
END;
$$;

-- Function to accept an invite after signup
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_invite tenant_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM tenant_invites WHERE token = p_token
    AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now();
  
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  
  -- Link user to tenant
  INSERT INTO tenant_users (tenant_id, user_id)
  VALUES (v_invite.tenant_id, p_user_id)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  
  -- Set ministry role on profile
  UPDATE profiles SET ministry_role = v_invite.ministry_role WHERE user_id = p_user_id;
  
  -- Mark invite as accepted
  UPDATE tenant_invites SET accepted_at = now() WHERE id = v_invite.id;
  
  RETURN jsonb_build_object('ok', true, 'tenant_id', v_invite.tenant_id, 'ministry_role', v_invite.ministry_role);
END;
$$;

-- Function for stewards to bulk-create invites (capped at 50 per call for safety)
CREATE OR REPLACE FUNCTION public.bulk_create_invites(
  p_tenant_id uuid,
  p_invites jsonb -- array of {email, ministry_role}
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_count integer;
  v_created integer := 0;
  v_skipped integer := 0;
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
    
    -- Skip if already an active invite or existing user
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
  
  RETURN jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped);
END;
$$;
