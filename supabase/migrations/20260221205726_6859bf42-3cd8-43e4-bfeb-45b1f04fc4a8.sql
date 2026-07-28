
-- ============================================================
-- RLS-LEVEL SOFT-DELETE FILTERING
-- Add deleted_at IS NULL condition to existing SELECT policies
-- This ensures all queries automatically exclude soft-deleted records
-- without needing to modify every individual query in the codebase.
-- ============================================================

-- OPPORTUNITIES: Update the main select policy
DROP POLICY IF EXISTS "Users can view opportunities" ON public.opportunities;
CREATE POLICY "Users can view opportunities"
  ON public.opportunities FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- CONTACTS: Update the main select policy
DROP POLICY IF EXISTS "Users can view contacts" ON public.contacts;
CREATE POLICY "Users can view contacts"
  ON public.contacts FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- METROS: Update the main select policy
DROP POLICY IF EXISTS "Users can view metros" ON public.metros;
CREATE POLICY "Users can view metros"
  ON public.metros FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- EVENTS: Update the main select policy
DROP POLICY IF EXISTS "Users can view events" ON public.events;
CREATE POLICY "Users can view events"
  ON public.events FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- GRANTS: Update the main select policy
DROP POLICY IF EXISTS "Users can view grants" ON public.grants;
CREATE POLICY "Users can view grants"
  ON public.grants FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- VOLUNTEERS: Update the main select policy
DROP POLICY IF EXISTS "Users can view volunteers" ON public.volunteers;
CREATE POLICY "Users can view volunteers"
  ON public.volunteers FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- Allow update for soft-delete operations (setting deleted_at)
DROP POLICY IF EXISTS "Users can soft-delete opportunities" ON public.opportunities;
CREATE POLICY "Users can soft-delete opportunities"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can soft-delete contacts" ON public.contacts;
CREATE POLICY "Users can soft-delete contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can soft-delete metros" ON public.metros;
CREATE POLICY "Users can soft-delete metros"
  ON public.metros FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can soft-delete events" ON public.events;
CREATE POLICY "Users can soft-delete events"
  ON public.events FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can soft-delete grants" ON public.grants;
CREATE POLICY "Users can soft-delete grants"
  ON public.grants FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can soft-delete volunteers" ON public.volunteers;
CREATE POLICY "Users can soft-delete volunteers"
  ON public.volunteers FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
