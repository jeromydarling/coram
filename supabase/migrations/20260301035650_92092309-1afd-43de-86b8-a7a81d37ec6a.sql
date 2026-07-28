
-- Add RLS policies to existing sync_conflicts table (table exists, just needs policies)
-- Check if RLS is enabled, enable if not
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (from partial migration) then recreate
DROP POLICY IF EXISTS "Tenant members can read sync conflicts" ON public.sync_conflicts;
DROP POLICY IF EXISTS "Shepherds can manage sync conflicts" ON public.sync_conflicts;

CREATE POLICY "Tenant members can read sync conflicts"
  ON public.sync_conflicts FOR SELECT
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Shepherds can manage sync conflicts"
  ON public.sync_conflicts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.tenant_id = sync_conflicts.tenant_id
      WHERE p.id = auth.uid()
      AND (p.ministry_role IN ('shepherd', 'steward') OR tu.role IN ('admin', 'owner'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.tenant_id = sync_conflicts.tenant_id
      WHERE p.id = auth.uid()
      AND (p.ministry_role IN ('shepherd', 'steward') OR tu.role IN ('admin', 'owner'))
    )
  );
