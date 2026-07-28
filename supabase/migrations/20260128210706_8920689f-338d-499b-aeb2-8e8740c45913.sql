-- =========================================
-- Profunda: Contacts quick-save support (MV3 extension) + safer RLS
-- =========================================

-- 1) Auto-generate contact_id so extension doesn't need to provide it
ALTER TABLE public.contacts
  ALTER COLUMN contact_id SET DEFAULT gen_random_uuid()::text;

-- Add unique constraint on contact_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'contacts_contact_id_key'
  ) THEN
    CREATE UNIQUE INDEX contacts_contact_id_key ON public.contacts (contact_id);
  END IF;
END $$;

-- 2) Add created_by for draft ownership (server-derived via auth.uid())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN created_by uuid DEFAULT auth.uid();
  END IF;
END $$;

-- 3) updated_at auto-maintenance trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RLS policies - drop old and create new

-- Drop old policies
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts for opportunities" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts for owned opportunities" ON public.contacts;
DROP POLICY IF EXISTS "Users can view contacts for owned opportunities" ON public.contacts;

-- DELETE: Admins/Leadership only
CREATE POLICY "Admins can delete contacts"
ON public.contacts
FOR DELETE
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
);

-- INSERT: Allow drafts, or opportunity access, require created_by = auth.uid()
CREATE POLICY "Users can create contacts"
ON public.contacts
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR opportunity_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM opportunities o
      WHERE o.id = contacts.opportunity_id
        AND (o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
    )
  )
);

-- UPDATE: Allow draft creator, opportunity owner, or metro access users
CREATE POLICY "Users can update contacts"
ON public.contacts
FOR UPDATE
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR (opportunity_id IS NULL AND created_by = auth.uid())
  OR EXISTS (
    SELECT 1
    FROM opportunities o
    WHERE o.id = contacts.opportunity_id
      AND (o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
  )
)
WITH CHECK (
  (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR created_by = auth.uid()
  )
  AND (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR (opportunity_id IS NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM opportunities o
      WHERE o.id = contacts.opportunity_id
        AND (o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
    )
  )
);

-- SELECT: Allow draft creator, or opportunity access
CREATE POLICY "Users can view contacts"
ON public.contacts
FOR SELECT
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR (opportunity_id IS NULL AND created_by = auth.uid())
  OR (
    opportunity_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM opportunities o
      WHERE o.id = contacts.opportunity_id
        AND (o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
    )
  )
);