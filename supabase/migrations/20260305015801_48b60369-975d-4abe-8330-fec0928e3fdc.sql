-- Allow tenant admins (tenant_users.role = 'admin') to insert/update/delete their own territories
CREATE POLICY "Tenant admins can manage own territories"
ON public.tenant_territories
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.tenant_id = tenant_territories.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.tenant_id = tenant_territories.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role = 'admin'
  )
);