-- Create a secure RPC function to access momentum data with metro access control
-- This respects RLS by filtering based on user's metro access

CREATE OR REPLACE FUNCTION public.get_metro_momentum_data()
RETURNS TABLE (
  metro_id UUID,
  metro_name TEXT,
  region_id UUID,
  normalized_momentum NUMERIC,
  momentum_status TEXT,
  anchors_90d INTEGER,
  events_this_quarter INTEGER,
  orders_30d INTEGER,
  computed_at TIMESTAMPTZ,
  lat NUMERIC,
  lng NUMERIC,
  has_milestone BOOLEAN,
  milestone_achieved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mms.metro_id,
    mms.metro_name,
    mms.region_id,
    mms.normalized_momentum,
    mms.momentum_status,
    mms.anchors_90d,
    mms.events_this_quarter,
    mms.orders_30d,
    mms.computed_at,
    m.lat,
    m.lng,
    CASE WHEN mm.id IS NOT NULL THEN true ELSE false END as has_milestone,
    mm.achieved_at as milestone_achieved_at
  FROM metro_momentum_signals mms
  JOIN metros m ON mms.metro_id = m.id
  LEFT JOIN metro_milestones mm ON mms.metro_id = mm.metro_id AND mm.milestone_type = 'first_anchor'
  WHERE 
    -- Admin and leadership see all metros
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    -- Others see only metros they have access to
    OR has_metro_access(auth.uid(), mms.metro_id);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_metro_momentum_data() TO authenticated;