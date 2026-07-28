-- ============================================
-- MOMENTUM HEATMAP DATABASE SCHEMA
-- ============================================

-- 1. GEO_GROUPS: Visual containers for states and regions
CREATE TABLE public.geo_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_group_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  geo_group_type TEXT NOT NULL CHECK (geo_group_type IN ('state', 'region')),
  geojson_id TEXT,
  center_lat NUMERIC(10, 6),
  center_lng NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. GEO_GROUP_METROS: Junction table linking metros to geo groups
CREATE TABLE public.geo_group_metros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_group_id UUID NOT NULL REFERENCES public.geo_groups(id) ON DELETE CASCADE,
  metro_id UUID NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(geo_group_id, metro_id)
);

-- 3. METRO_MILESTONES: Celebratory moments tracking
CREATE TABLE public.metro_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id UUID NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN ('first_anchor')),
  achieved_at TIMESTAMPTZ NOT NULL,
  anchor_id UUID REFERENCES public.anchors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(metro_id, milestone_type)
);

-- 4. Add lat/lng columns to metros table
ALTER TABLE public.metros ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 6);
ALTER TABLE public.metros ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 6);

-- 5. Enable RLS on new tables
ALTER TABLE public.geo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_group_metros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metro_milestones ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for geo_groups (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view geo groups"
  ON public.geo_groups FOR SELECT
  TO authenticated
  USING (true);

-- 7. RLS Policies for geo_group_metros (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view geo group metros"
  ON public.geo_group_metros FOR SELECT
  TO authenticated
  USING (true);

-- 8. RLS Policies for metro_milestones (via metro access)
CREATE POLICY "Users can view milestones for accessible metros"
  ON public.metro_milestones FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR has_metro_access(auth.uid(), metro_id)
  );

-- 9. Admin policies for managing geo_groups
CREATE POLICY "Admins can manage geo groups"
  ON public.geo_groups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 10. Admin policies for managing geo_group_metros
CREATE POLICY "Admins can manage geo group metros"
  ON public.geo_group_metros FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 11. Admin policies for managing metro_milestones
CREATE POLICY "Admins can manage metro milestones"
  ON public.metro_milestones FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 12. MATERIALIZED VIEW: metro_momentum_signals
CREATE MATERIALIZED VIEW public.metro_momentum_signals AS
WITH anchor_signals AS (
  SELECT 
    metro_id,
    COALESCE(first_volume_date, agreement_signed_date)::DATE as activity_date,
    5.0 as weight
  FROM public.anchors
  WHERE COALESCE(first_volume_date, agreement_signed_date) IS NOT NULL
    AND metro_id IS NOT NULL
),
event_signals AS (
  SELECT 
    metro_id,
    event_date::DATE as activity_date,
    2.0 as weight
  FROM public.events
  WHERE attended = true
    AND metro_id IS NOT NULL
),
order_signals AS (
  SELECT 
    o.metro_id,
    oo.order_date::DATE as activity_date,
    1.0 * LEAST(oo.order_count, 10) as weight
  FROM public.opportunity_orders oo
  JOIN public.opportunities o ON oo.opportunity_id = o.id
  WHERE o.metro_id IS NOT NULL
    AND oo.order_date IS NOT NULL
),
all_signals AS (
  SELECT metro_id, activity_date, weight FROM anchor_signals
  UNION ALL
  SELECT metro_id, activity_date, weight FROM event_signals  
  UNION ALL
  SELECT metro_id, activity_date, weight FROM order_signals
),
decayed_signals AS (
  SELECT 
    metro_id,
    activity_date,
    weight,
    GREATEST(0.25, EXP(-(CURRENT_DATE - activity_date)::NUMERIC / 45)) as decay_factor
  FROM all_signals
  WHERE activity_date >= CURRENT_DATE - INTERVAL '180 days'
    AND activity_date <= CURRENT_DATE
),
raw_momentum_calc AS (
  SELECT 
    metro_id,
    SUM(weight * decay_factor) as raw_momentum
  FROM decayed_signals
  GROUP BY metro_id
),
monthly_signals AS (
  SELECT 
    metro_id,
    DATE_TRUNC('month', activity_date) as month,
    SUM(weight * GREATEST(0.25, EXP(-(CURRENT_DATE - activity_date)::NUMERIC / 45))) as month_raw
  FROM all_signals
  WHERE activity_date >= CURRENT_DATE - INTERVAL '180 days'
    AND activity_date <= CURRENT_DATE
  GROUP BY metro_id, DATE_TRUNC('month', activity_date)
),
baseline_calc AS (
  SELECT 
    metro_id,
    GREATEST(0.1, COALESCE(AVG(month_raw), 0.1)) as baseline_momentum
  FROM monthly_signals
  GROUP BY metro_id
),
anchor_counts AS (
  SELECT 
    metro_id,
    COUNT(*) as anchors_90d
  FROM public.anchors
  WHERE COALESCE(first_volume_date, agreement_signed_date) >= CURRENT_DATE - 90
    AND metro_id IS NOT NULL
  GROUP BY metro_id
),
event_counts AS (
  SELECT 
    metro_id,
    COUNT(*) as events_this_quarter
  FROM public.events
  WHERE attended = true 
    AND metro_id IS NOT NULL
    AND event_date >= DATE_TRUNC('quarter', CURRENT_DATE)
  GROUP BY metro_id
),
order_counts AS (
  SELECT 
    o.metro_id,
    COALESCE(SUM(oo.order_count), 0) as orders_30d
  FROM public.opportunity_orders oo
  JOIN public.opportunities o ON oo.opportunity_id = o.id
  WHERE o.metro_id IS NOT NULL
    AND oo.order_date >= CURRENT_DATE - 30
  GROUP BY o.metro_id
)
SELECT 
  m.id as metro_id,
  m.metro as metro_name,
  m.region_id,
  COALESCE(rm.raw_momentum, 0)::NUMERIC as raw_momentum,
  COALESCE(bc.baseline_momentum, 0.1)::NUMERIC as baseline_momentum,
  LEAST(2.0, COALESCE(rm.raw_momentum, 0) / GREATEST(COALESCE(bc.baseline_momentum, 0.1), 0.1))::NUMERIC as normalized_momentum,
  CASE 
    WHEN COALESCE(rm.raw_momentum, 0) / GREATEST(COALESCE(bc.baseline_momentum, 0.1), 0.1) >= 1.5 THEN 'Strong'
    WHEN COALESCE(rm.raw_momentum, 0) / GREATEST(COALESCE(bc.baseline_momentum, 0.1), 0.1) >= 1.0 THEN 'Growing'
    WHEN COALESCE(rm.raw_momentum, 0) / GREATEST(COALESCE(bc.baseline_momentum, 0.1), 0.1) >= 0.5 THEN 'Steady'
    ELSE 'Resting'
  END as momentum_status,
  COALESCE(ac.anchors_90d, 0)::INTEGER as anchors_90d,
  COALESCE(ec.events_this_quarter, 0)::INTEGER as events_this_quarter,
  COALESCE(oc.orders_30d, 0)::INTEGER as orders_30d,
  now() as computed_at
FROM public.metros m
LEFT JOIN raw_momentum_calc rm ON m.id = rm.metro_id
LEFT JOIN baseline_calc bc ON m.id = bc.metro_id
LEFT JOIN anchor_counts ac ON m.id = ac.metro_id
LEFT JOIN event_counts ec ON m.id = ec.metro_id
LEFT JOIN order_counts oc ON m.id = oc.metro_id;

-- 13. Unique index for CONCURRENT refresh
CREATE UNIQUE INDEX idx_metro_momentum_signals_metro_id 
  ON public.metro_momentum_signals(metro_id);

-- 14. Refresh function (SECURITY DEFINER for safe execution)
CREATE OR REPLACE FUNCTION public.refresh_metro_momentum()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.metro_momentum_signals;
END;
$$;

-- 15. Milestone detection trigger function
CREATE OR REPLACE FUNCTION public.check_first_anchor_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_date DATE;
  v_existing_count INTEGER;
BEGIN
  -- Calculate activity date
  v_activity_date := COALESCE(NEW.first_volume_date, NEW.agreement_signed_date);
  
  -- Only proceed if we have a valid activity date and metro_id
  IF v_activity_date IS NOT NULL AND NEW.metro_id IS NOT NULL THEN
    -- Check if this metro already has a first_anchor milestone
    IF NOT EXISTS (
      SELECT 1 FROM public.metro_milestones 
      WHERE metro_id = NEW.metro_id AND milestone_type = 'first_anchor'
    ) THEN
      -- Count existing anchors with activity dates for this metro (excluding current)
      SELECT COUNT(*) INTO v_existing_count
      FROM public.anchors 
      WHERE metro_id = NEW.metro_id 
        AND COALESCE(first_volume_date, agreement_signed_date) IS NOT NULL 
        AND id != NEW.id;
      
      -- If this is truly the first anchor, create the milestone
      IF v_existing_count = 0 THEN
        INSERT INTO public.metro_milestones (metro_id, milestone_type, achieved_at, anchor_id)
        VALUES (NEW.metro_id, 'first_anchor', v_activity_date::TIMESTAMPTZ, NEW.id)
        ON CONFLICT (metro_id, milestone_type) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 16. Create trigger on anchors table
CREATE TRIGGER trg_check_first_anchor_milestone
  AFTER INSERT OR UPDATE OF first_volume_date, agreement_signed_date ON public.anchors
  FOR EACH ROW
  EXECUTE FUNCTION public.check_first_anchor_milestone();

-- 17. Seed 50 US states into geo_groups
INSERT INTO public.geo_groups (geo_group_id, name, geo_group_type, geojson_id, center_lat, center_lng) VALUES
  ('AL', 'Alabama', 'state', 'Alabama', 32.806671, -86.791130),
  ('AK', 'Alaska', 'state', 'Alaska', 61.370716, -152.404419),
  ('AZ', 'Arizona', 'state', 'Arizona', 33.729759, -111.431221),
  ('AR', 'Arkansas', 'state', 'Arkansas', 34.969704, -92.373123),
  ('CA', 'California', 'state', 'California', 36.116203, -119.681564),
  ('CO', 'Colorado', 'state', 'Colorado', 39.059811, -105.311104),
  ('CT', 'Connecticut', 'state', 'Connecticut', 41.597782, -72.755371),
  ('DE', 'Delaware', 'state', 'Delaware', 39.318523, -75.507141),
  ('FL', 'Florida', 'state', 'Florida', 27.766279, -81.686783),
  ('GA', 'Georgia', 'state', 'Georgia', 33.040619, -83.643074),
  ('HI', 'Hawaii', 'state', 'Hawaii', 21.094318, -157.498337),
  ('ID', 'Idaho', 'state', 'Idaho', 44.240459, -114.478828),
  ('IL', 'Illinois', 'state', 'Illinois', 40.349457, -88.986137),
  ('IN', 'Indiana', 'state', 'Indiana', 39.849426, -86.258278),
  ('IA', 'Iowa', 'state', 'Iowa', 42.011539, -93.210526),
  ('KS', 'Kansas', 'state', 'Kansas', 38.526600, -96.726486),
  ('KY', 'Kentucky', 'state', 'Kentucky', 37.668140, -84.670067),
  ('LA', 'Louisiana', 'state', 'Louisiana', 31.169546, -91.867805),
  ('ME', 'Maine', 'state', 'Maine', 44.693947, -69.381927),
  ('MD', 'Maryland', 'state', 'Maryland', 39.063946, -76.802101),
  ('MA', 'Massachusetts', 'state', 'Massachusetts', 42.230171, -71.530106),
  ('MI', 'Michigan', 'state', 'Michigan', 43.326618, -84.536095),
  ('MN', 'Minnesota', 'state', 'Minnesota', 45.694454, -93.900192),
  ('MS', 'Mississippi', 'state', 'Mississippi', 32.741646, -89.678696),
  ('MO', 'Missouri', 'state', 'Missouri', 38.456085, -92.288368),
  ('MT', 'Montana', 'state', 'Montana', 46.921925, -110.454353),
  ('NE', 'Nebraska', 'state', 'Nebraska', 41.125370, -98.268082),
  ('NV', 'Nevada', 'state', 'Nevada', 38.313515, -117.055374),
  ('NH', 'New Hampshire', 'state', 'New Hampshire', 43.452492, -71.563896),
  ('NJ', 'New Jersey', 'state', 'New Jersey', 40.298904, -74.521011),
  ('NM', 'New Mexico', 'state', 'New Mexico', 34.840515, -106.248482),
  ('NY', 'New York', 'state', 'New York', 42.165726, -74.948051),
  ('NC', 'North Carolina', 'state', 'North Carolina', 35.630066, -79.806419),
  ('ND', 'North Dakota', 'state', 'North Dakota', 47.528912, -99.784012),
  ('OH', 'Ohio', 'state', 'Ohio', 40.388783, -82.764915),
  ('OK', 'Oklahoma', 'state', 'Oklahoma', 35.565342, -96.928917),
  ('OR', 'Oregon', 'state', 'Oregon', 44.572021, -122.070938),
  ('PA', 'Pennsylvania', 'state', 'Pennsylvania', 40.590752, -77.209755),
  ('RI', 'Rhode Island', 'state', 'Rhode Island', 41.680893, -71.511780),
  ('SC', 'South Carolina', 'state', 'South Carolina', 33.856892, -80.945007),
  ('SD', 'South Dakota', 'state', 'South Dakota', 44.299782, -99.438828),
  ('TN', 'Tennessee', 'state', 'Tennessee', 35.747845, -86.692345),
  ('TX', 'Texas', 'state', 'Texas', 31.054487, -97.563461),
  ('UT', 'Utah', 'state', 'Utah', 40.150032, -111.862434),
  ('VT', 'Vermont', 'state', 'Vermont', 44.045876, -72.710686),
  ('VA', 'Virginia', 'state', 'Virginia', 37.769337, -78.169968),
  ('WA', 'Washington', 'state', 'Washington', 47.400902, -121.490494),
  ('WV', 'West Virginia', 'state', 'West Virginia', 38.491226, -80.954453),
  ('WI', 'Wisconsin', 'state', 'Wisconsin', 44.268543, -89.616508),
  ('WY', 'Wyoming', 'state', 'Wyoming', 42.755966, -107.302490),
  ('DC', 'District of Columbia', 'state', 'District of Columbia', 38.897438, -77.026817)
ON CONFLICT (geo_group_id) DO NOTHING;

-- 18. Seed common metro coordinates (will need to be updated with actual metros)
-- Update existing metros with coordinates based on metro name patterns
UPDATE public.metros SET lat = 41.8781, lng = -87.6298 WHERE metro ILIKE '%Chicago%' AND lat IS NULL;
UPDATE public.metros SET lat = 44.9778, lng = -93.2650 WHERE metro ILIKE '%Minneapolis%' AND lat IS NULL;
UPDATE public.metros SET lat = 44.9537, lng = -93.0900 WHERE metro ILIKE '%St. Paul%' AND lat IS NULL;
UPDATE public.metros SET lat = 40.4167, lng = -86.8753 WHERE metro ILIKE '%Lafayette%' AND lat IS NULL;
UPDATE public.metros SET lat = 39.7392, lng = -104.9903 WHERE metro ILIKE '%Denver%' AND lat IS NULL;
UPDATE public.metros SET lat = 33.4484, lng = -112.0740 WHERE metro ILIKE '%Phoenix%' AND lat IS NULL;
UPDATE public.metros SET lat = 29.7604, lng = -95.3698 WHERE metro ILIKE '%Houston%' AND lat IS NULL;
UPDATE public.metros SET lat = 32.7767, lng = -96.7970 WHERE metro ILIKE '%Dallas%' AND lat IS NULL;
UPDATE public.metros SET lat = 29.4241, lng = -98.4936 WHERE metro ILIKE '%San Antonio%' AND lat IS NULL;
UPDATE public.metros SET lat = 30.2672, lng = -97.7431 WHERE metro ILIKE '%Austin%' AND lat IS NULL;
UPDATE public.metros SET lat = 39.9612, lng = -82.9988 WHERE metro ILIKE '%Columbus%' AND lat IS NULL;
UPDATE public.metros SET lat = 41.4993, lng = -81.6944 WHERE metro ILIKE '%Cleveland%' AND lat IS NULL;
UPDATE public.metros SET lat = 39.1031, lng = -84.5120 WHERE metro ILIKE '%Cincinnati%' AND lat IS NULL;
UPDATE public.metros SET lat = 42.3314, lng = -83.0458 WHERE metro ILIKE '%Detroit%' AND lat IS NULL;
UPDATE public.metros SET lat = 39.7684, lng = -86.1581 WHERE metro ILIKE '%Indianapolis%' AND lat IS NULL;
UPDATE public.metros SET lat = 38.6270, lng = -90.1994 WHERE metro ILIKE '%St. Louis%' AND lat IS NULL;
UPDATE public.metros SET lat = 39.0997, lng = -94.5786 WHERE metro ILIKE '%Kansas City%' AND lat IS NULL;
UPDATE public.metros SET lat = 41.2565, lng = -95.9345 WHERE metro ILIKE '%Omaha%' AND lat IS NULL;
UPDATE public.metros SET lat = 43.0389, lng = -87.9065 WHERE metro ILIKE '%Milwaukee%' AND lat IS NULL;
UPDATE public.metros SET lat = 33.7490, lng = -84.3880 WHERE metro ILIKE '%Atlanta%' AND lat IS NULL;
UPDATE public.metros SET lat = 35.2271, lng = -80.8431 WHERE metro ILIKE '%Charlotte%' AND lat IS NULL;
UPDATE public.metros SET lat = 35.7796, lng = -78.6382 WHERE metro ILIKE '%Raleigh%' AND lat IS NULL;
UPDATE public.metros SET lat = 25.7617, lng = -80.1918 WHERE metro ILIKE '%Miami%' AND lat IS NULL;
UPDATE public.metros SET lat = 28.5383, lng = -81.3792 WHERE metro ILIKE '%Orlando%' AND lat IS NULL;
UPDATE public.metros SET lat = 27.9506, lng = -82.4572 WHERE metro ILIKE '%Tampa%' AND lat IS NULL;
UPDATE public.metros SET lat = 40.7128, lng = -74.0060 WHERE metro ILIKE '%New York%' AND lat IS NULL;
UPDATE public.metros SET lat = 39.9526, lng = -75.1652 WHERE metro ILIKE '%Philadelphia%' AND lat IS NULL;
UPDATE public.metros SET lat = 42.3601, lng = -71.0589 WHERE metro ILIKE '%Boston%' AND lat IS NULL;
UPDATE public.metros SET lat = 38.9072, lng = -77.0369 WHERE metro ILIKE '%Washington%' AND lat IS NULL;
UPDATE public.metros SET lat = 39.2904, lng = -76.6122 WHERE metro ILIKE '%Baltimore%' AND lat IS NULL;
UPDATE public.metros SET lat = 40.4406, lng = -79.9959 WHERE metro ILIKE '%Pittsburgh%' AND lat IS NULL;
UPDATE public.metros SET lat = 34.0522, lng = -118.2437 WHERE metro ILIKE '%Los Angeles%' AND lat IS NULL;
UPDATE public.metros SET lat = 37.7749, lng = -122.4194 WHERE metro ILIKE '%San Francisco%' AND lat IS NULL;
UPDATE public.metros SET lat = 32.7157, lng = -117.1611 WHERE metro ILIKE '%San Diego%' AND lat IS NULL;
UPDATE public.metros SET lat = 47.6062, lng = -122.3321 WHERE metro ILIKE '%Seattle%' AND lat IS NULL;
UPDATE public.metros SET lat = 45.5152, lng = -122.6784 WHERE metro ILIKE '%Portland%' AND lat IS NULL;
UPDATE public.metros SET lat = 36.1699, lng = -115.1398 WHERE metro ILIKE '%Las Vegas%' AND lat IS NULL;
UPDATE public.metros SET lat = 40.7608, lng = -111.8910 WHERE metro ILIKE '%Salt Lake%' AND lat IS NULL;
UPDATE public.metros SET lat = 35.4676, lng = -97.5164 WHERE metro ILIKE '%Oklahoma City%' AND lat IS NULL;
UPDATE public.metros SET lat = 35.0844, lng = -106.6504 WHERE metro ILIKE '%Albuquerque%' AND lat IS NULL;
UPDATE public.metros SET lat = 32.2226, lng = -110.9747 WHERE metro ILIKE '%Tucson%' AND lat IS NULL;
UPDATE public.metros SET lat = 36.1627, lng = -86.7816 WHERE metro ILIKE '%Nashville%' AND lat IS NULL;
UPDATE public.metros SET lat = 35.1495, lng = -90.0490 WHERE metro ILIKE '%Memphis%' AND lat IS NULL;
UPDATE public.metros SET lat = 38.2527, lng = -85.7585 WHERE metro ILIKE '%Louisville%' AND lat IS NULL;
UPDATE public.metros SET lat = 30.4515, lng = -91.1871 WHERE metro ILIKE '%Baton Rouge%' AND lat IS NULL;
UPDATE public.metros SET lat = 29.9511, lng = -90.0715 WHERE metro ILIKE '%New Orleans%' AND lat IS NULL;
UPDATE public.metros SET lat = 32.7765, lng = -79.9311 WHERE metro ILIKE '%Charleston%' AND lat IS NULL;
UPDATE public.metros SET lat = 34.0007, lng = -81.0348 WHERE metro ILIKE '%Columbia%' AND lat IS NULL;
UPDATE public.metros SET lat = 36.8529, lng = -75.9780 WHERE metro ILIKE '%Virginia Beach%' AND lat IS NULL;
UPDATE public.metros SET lat = 37.5407, lng = -77.4360 WHERE metro ILIKE '%Richmond%' AND lat IS NULL;

-- 19. Backfill existing first-anchor milestones
INSERT INTO public.metro_milestones (metro_id, milestone_type, achieved_at, anchor_id)
SELECT DISTINCT ON (a.metro_id)
  a.metro_id,
  'first_anchor',
  COALESCE(a.first_volume_date, a.agreement_signed_date)::TIMESTAMPTZ,
  a.id
FROM public.anchors a
WHERE a.metro_id IS NOT NULL
  AND COALESCE(a.first_volume_date, a.agreement_signed_date) IS NOT NULL
ORDER BY a.metro_id, COALESCE(a.first_volume_date, a.agreement_signed_date) ASC
ON CONFLICT (metro_id, milestone_type) DO NOTHING;