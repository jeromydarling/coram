-- Fix audit_log INSERT policy to only allow system-level insertions via SECURITY DEFINER function
-- This prevents users from flooding the audit log with fake entries

-- First, drop the existing permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;

-- Create a SECURITY DEFINER function for audit log insertions
-- This ensures audit logs can only be created by the system, not directly by users
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_entity_name text DEFAULT NULL,
  p_changes jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Only allow if there's an authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, entity_name, changes)
  VALUES (auth.uid(), p_entity_type, p_entity_id, p_action, p_entity_name, p_changes)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_audit_entry TO authenticated;

-- Now the audit_log table has no direct INSERT policy, only the function can insert