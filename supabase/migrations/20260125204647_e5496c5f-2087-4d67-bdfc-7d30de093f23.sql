-- Add new fields to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS host_organization TEXT,
ADD COLUMN IF NOT EXISTS target_populations TEXT[],
ADD COLUMN IF NOT EXISTS strategic_lanes TEXT[],
ADD COLUMN IF NOT EXISTS pcs_goals TEXT[],
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')),
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('Registered', 'Not Registered')),
ADD COLUMN IF NOT EXISTS travel_required TEXT CHECK (travel_required IN ('Local', 'Regional')),
ADD COLUMN IF NOT EXISTS expected_households TEXT,
ADD COLUMN IF NOT EXISTS expected_referrals TEXT,
ADD COLUMN IF NOT EXISTS anchor_potential TEXT CHECK (anchor_potential IN ('High', 'Medium', 'Very High', 'Extremely High'));

-- Create lookup tables for the multi-select options (for admin management)
CREATE TABLE IF NOT EXISTS public.event_target_populations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_strategic_lanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_pcs_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on lookup tables
ALTER TABLE public.event_target_populations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_strategic_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_pcs_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for lookup tables (same pattern as sectors/grant_alignments)
CREATE POLICY "Authenticated users can view target populations"
ON public.event_target_populations FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage target populations"
ON public.event_target_populations FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view strategic lanes"
ON public.event_strategic_lanes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage strategic lanes"
ON public.event_strategic_lanes FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view pcs goals"
ON public.event_pcs_goals FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage pcs goals"
ON public.event_pcs_goals FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add updated_at triggers
CREATE TRIGGER update_event_target_populations_updated_at
BEFORE UPDATE ON public.event_target_populations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_strategic_lanes_updated_at
BEFORE UPDATE ON public.event_strategic_lanes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_pcs_goals_updated_at
BEFORE UPDATE ON public.event_pcs_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();