
-- ============================================================
-- PART A: Split sensitive payloads from recycle_bin
-- ============================================================

-- 1. Create recycle_bin_payloads table
CREATE TABLE IF NOT EXISTS public.recycle_bin_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recycle_bin_id uuid NOT NULL UNIQUE REFERENCES public.recycle_bin(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  entity_name text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_payloads_tenant ON public.recycle_bin_payloads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_payloads_recycle ON public.recycle_bin_payloads (recycle_bin_id);

-- 2. Backfill existing data
INSERT INTO public.recycle_bin_payloads (recycle_bin_id, tenant_id, entity_name, snapshot)
SELECT id, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), entity_name, snapshot
FROM public.recycle_bin
WHERE entity_name IS NOT NULL OR snapshot IS NOT NULL
ON CONFLICT (recycle_bin_id) DO NOTHING;

-- 3. Null out sensitive columns in recycle_bin (keep columns to avoid breaking types, but clear data)
UPDATE public.recycle_bin SET entity_name = NULL, snapshot = '{}'::jsonb;

-- 4. RLS on recycle_bin_payloads
ALTER TABLE public.recycle_bin_payloads ENABLE ROW LEVEL SECURITY;

-- Tenant members can see their own payloads
CREATE POLICY "Tenants see own recycle payloads"
  ON public.recycle_bin_payloads FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- NO operator/admin SELECT policy — operators cannot see payloads at all

-- Insert: only via service role (trigger function runs as SECURITY DEFINER)
-- No direct insert policy needed for regular users

-- 5. Create safe tenant view
CREATE OR REPLACE VIEW public.recycle_bin_tenant_v
WITH (security_invoker = on) AS
SELECT
  rb.id,
  rb.entity_type,
  rb.entity_id,
  rb.tenant_id,
  rb.deleted_by,
  rb.deleted_at,
  rb.restored_at,
  rb.restored_by,
  rb.purged_at,
  rb.created_at,
  p.entity_name,
  p.snapshot
FROM public.recycle_bin rb
LEFT JOIN public.recycle_bin_payloads p ON p.recycle_bin_id = rb.id;

-- 6. Update snapshot_to_recycle_bin trigger to also write to payloads table
CREATE OR REPLACE FUNCTION public.snapshot_to_recycle_bin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entity_name text;
  v_tenant_id uuid;
  v_recycle_id uuid;
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN

    v_entity_name := CASE TG_TABLE_NAME
      WHEN 'opportunities' THEN (OLD.organization)::text
      WHEN 'contacts' THEN (OLD.name)::text
      WHEN 'metros' THEN (OLD.metro)::text
      WHEN 'events' THEN (OLD.event_name)::text
      WHEN 'grants' THEN (OLD.grant_name)::text
      WHEN 'volunteers' THEN (OLD.name)::text
      ELSE 'Unknown'
    END;

    v_tenant_id := CASE
      WHEN TG_TABLE_NAME IN ('opportunities', 'contacts', 'events', 'volunteers')
        THEN (OLD.tenant_id)::uuid
      ELSE NULL
    END;

    v_recycle_id := gen_random_uuid();

    -- Insert metadata-only row into recycle_bin (no entity_name, no snapshot)
    INSERT INTO public.recycle_bin (id, entity_type, entity_id, entity_name, tenant_id, deleted_by, deleted_at, snapshot)
    VALUES (
      v_recycle_id,
      TG_TABLE_NAME,
      OLD.id,
      NULL,  -- entity_name no longer stored here
      v_tenant_id,
      NEW.deleted_by,
      NEW.deleted_at,
      '{}'::jsonb  -- empty snapshot in metadata table
    );

    -- Store sensitive payload separately
    INSERT INTO public.recycle_bin_payloads (recycle_bin_id, tenant_id, entity_name, snapshot)
    VALUES (
      v_recycle_id,
      COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
      v_entity_name,
      to_jsonb(OLD)
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. Update restore function to read from payloads (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.restore_from_recycle_bin(p_recycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record recycle_bin%ROWTYPE;
  v_entity_name text;
  v_table text;
BEGIN
  SELECT * INTO v_record
  FROM recycle_bin
  WHERE id = p_recycle_id
    AND restored_at IS NULL
    AND purged_at IS NULL;

  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'Recycle bin entry not found or already restored';
  END IF;

  -- Get entity_name from payloads table (SECURITY DEFINER can read it)
  SELECT entity_name INTO v_entity_name
  FROM recycle_bin_payloads
  WHERE recycle_bin_id = p_recycle_id;

  v_table := v_record.entity_type;

  -- Restore = clear deleted_at and deleted_by
  EXECUTE format(
    'UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1',
    v_table
  ) USING v_record.entity_id;

  -- Mark as restored in recycle bin
  UPDATE recycle_bin
  SET restored_at = now(), restored_by = auth.uid()
  WHERE id = p_recycle_id;

  RETURN jsonb_build_object(
    'ok', true,
    'entity_type', v_record.entity_type,
    'entity_id', v_record.entity_id,
    'entity_name', COALESCE(v_entity_name, 'item')
  );
END;
$function$;

-- 8. Update purge function to handle payloads (cascade handles cleanup)
-- No changes needed — ON DELETE CASCADE on recycle_bin_payloads handles it

-- 9. Drop the operator "see all" policy and replace with metadata-only
-- (The existing policy lets operators SELECT * including entity_name/snapshot columns,
--  but now those columns are always NULL in recycle_bin, so it's safe. 
--  We keep the policy as-is since the data is no longer there.)
