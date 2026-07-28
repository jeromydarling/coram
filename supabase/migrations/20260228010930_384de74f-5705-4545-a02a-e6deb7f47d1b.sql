-- Atomic sector replacement function to prevent partial state
-- (delete + insert in one transaction)
CREATE OR REPLACE FUNCTION public.replace_tenant_sectors(
  p_tenant_id uuid,
  p_sector_ids uuid[],
  p_max_sectors int DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate count
  IF array_length(p_sector_ids, 1) IS NOT NULL AND array_length(p_sector_ids, 1) > p_max_sectors THEN
    RAISE EXCEPTION 'Maximum % sectors allowed', p_max_sectors;
  END IF;

  -- Verify caller owns this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this tenant';
  END IF;

  -- Delete existing
  DELETE FROM tenant_sectors WHERE tenant_id = p_tenant_id;

  -- Insert new (first = primary)
  IF p_sector_ids IS NOT NULL AND array_length(p_sector_ids, 1) > 0 THEN
    INSERT INTO tenant_sectors (tenant_id, sector_id, is_primary)
    SELECT p_tenant_id, unnest_id, (row_number = 1)
    FROM (
      SELECT unnest(p_sector_ids) AS unnest_id,
             row_number() OVER () AS row_number
    ) sub;
  END IF;
END;
$$;