
-- ============================================================
-- SOFT-DELETE: Add deleted_at / deleted_by to major tables
-- ============================================================

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.metros
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.grants
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.volunteers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- Partial indexes for query performance (only index active rows)
CREATE INDEX IF NOT EXISTS idx_opportunities_active ON public.opportunities (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_active ON public.contacts (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_metros_active ON public.metros (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_active ON public.events (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_grants_active ON public.grants (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_volunteers_active ON public.volunteers (id) WHERE deleted_at IS NULL;

-- ============================================================
-- RECYCLE BIN: Central deep-recovery table (90-day retention)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recycle_bin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text,
  tenant_id uuid,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  restored_at timestamptz DEFAULT NULL,
  restored_by uuid DEFAULT NULL,
  purged_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_entity ON public.recycle_bin (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_tenant ON public.recycle_bin (tenant_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_deleted_at ON public.recycle_bin (deleted_at);

ALTER TABLE public.recycle_bin ENABLE ROW LEVEL SECURITY;

-- Tenants can see their own recycle bin items (7 days)
CREATE POLICY "Tenants see own deleted items (7 days)"
  ON public.recycle_bin FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
    AND deleted_at > now() - interval '7 days'
    AND restored_at IS NULL
    AND purged_at IS NULL
  );

-- Operators see all recycle bin items (90 days)
CREATE POLICY "Operators see all deleted items (90 days)"
  ON public.recycle_bin FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
    AND deleted_at > now() - interval '90 days'
    AND purged_at IS NULL
  );

-- Tenants can restore their own items (within 7 days)
CREATE POLICY "Tenants restore own items"
  ON public.recycle_bin FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
    AND deleted_at > now() - interval '7 days'
    AND restored_at IS NULL
    AND purged_at IS NULL
  )
  WITH CHECK (
    restored_by = auth.uid()
  );

-- Operators can restore any item
CREATE POLICY "Operators restore any item"
  ON public.recycle_bin FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
    AND restored_at IS NULL
    AND purged_at IS NULL
  )
  WITH CHECK (
    restored_by = auth.uid()
  );

-- Insert policy for the trigger
CREATE POLICY "System can insert to recycle bin"
  ON public.recycle_bin FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- TRIGGER: Auto-snapshot to recycle_bin on soft-delete
-- ============================================================

CREATE OR REPLACE FUNCTION public.snapshot_to_recycle_bin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entity_name text;
  v_tenant_id uuid;
BEGIN
  -- Only fire when deleted_at transitions from NULL to non-NULL
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN

    -- Determine entity name
    v_entity_name := CASE TG_TABLE_NAME
      WHEN 'opportunities' THEN (OLD.organization)::text
      WHEN 'contacts' THEN (OLD.name)::text
      WHEN 'metros' THEN (OLD.metro)::text
      WHEN 'events' THEN (OLD.event_name)::text
      WHEN 'grants' THEN (OLD.grant_name)::text
      WHEN 'volunteers' THEN (OLD.name)::text
      ELSE 'Unknown'
    END;

    -- Determine tenant_id
    v_tenant_id := CASE
      WHEN TG_TABLE_NAME IN ('opportunities', 'contacts', 'events', 'volunteers')
        THEN (OLD.tenant_id)::uuid
      ELSE NULL
    END;

    INSERT INTO public.recycle_bin (entity_type, entity_id, entity_name, tenant_id, deleted_by, deleted_at, snapshot)
    VALUES (
      TG_TABLE_NAME,
      OLD.id,
      v_entity_name,
      v_tenant_id,
      NEW.deleted_by,
      NEW.deleted_at,
      to_jsonb(OLD)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach triggers to all soft-delete tables
CREATE OR REPLACE TRIGGER trg_recycle_opportunities
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_to_recycle_bin();

CREATE OR REPLACE TRIGGER trg_recycle_contacts
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_to_recycle_bin();

CREATE OR REPLACE TRIGGER trg_recycle_metros
  BEFORE UPDATE ON public.metros
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_to_recycle_bin();

CREATE OR REPLACE TRIGGER trg_recycle_events
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_to_recycle_bin();

CREATE OR REPLACE TRIGGER trg_recycle_grants
  BEFORE UPDATE ON public.grants
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_to_recycle_bin();

CREATE OR REPLACE TRIGGER trg_recycle_volunteers
  BEFORE UPDATE ON public.volunteers
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_to_recycle_bin();

-- ============================================================
-- RESTORE FUNCTION: Re-activates a soft-deleted record
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_from_recycle_bin(p_recycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record recycle_bin%ROWTYPE;
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
    'entity_name', v_record.entity_name
  );
END;
$$;

-- ============================================================
-- AUTO-PURGE: Hard-delete records older than 90 days
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_recycle_bin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hard_deleted integer := 0;
  v_purged integer := 0;
  v_rec record;
BEGIN
  -- Find entries older than 90 days that haven't been restored
  FOR v_rec IN
    SELECT id, entity_type, entity_id
    FROM recycle_bin
    WHERE deleted_at < now() - interval '90 days'
      AND restored_at IS NULL
      AND purged_at IS NULL
  LOOP
    -- Hard-delete the actual record
    EXECUTE format('DELETE FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL', v_rec.entity_type)
    USING v_rec.entity_id;

    GET DIAGNOSTICS v_hard_deleted = ROW_COUNT;

    -- Mark as purged
    UPDATE recycle_bin SET purged_at = now() WHERE id = v_rec.id;
    v_purged := v_purged + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'purged_count', v_purged);
END;
$$;
