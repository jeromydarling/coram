-- =============================================
-- GRANT TRACKING MODULE - DATABASE SCHEMA
-- =============================================

-- 1) CREATE ENUMS
-- =============================================

-- Grant pipeline stages
CREATE TYPE public.grant_stage AS ENUM (
  'Researching',
  'Eligible',
  'Cultivating',
  'LOI Submitted',
  'Full Proposal Submitted',
  'Awarded',
  'Declined',
  'Closed'
);

-- Funder types
CREATE TYPE public.funder_type AS ENUM (
  'Foundation',
  'Government - Federal',
  'Government - State',
  'Government - Local',
  'Corporate',
  'Other'
);

-- Reporting frequency
CREATE TYPE public.reporting_frequency AS ENUM (
  'Quarterly',
  'Annual',
  'End of Grant'
);

-- Grant status
CREATE TYPE public.grant_status AS ENUM (
  'Active',
  'Closed'
);

-- Grant activity types
CREATE TYPE public.grant_activity_type AS ENUM (
  'Research',
  'Call',
  'Meeting',
  'Writing',
  'Submission',
  'Reporting'
);

-- 2) CREATE LOOKUP TABLE: grant_types
-- =============================================

CREATE TABLE public.grant_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT 'hsl(var(--muted-foreground))',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed values
INSERT INTO public.grant_types (name, description, sort_order) VALUES
  ('Operating', 'General operating support', 1),
  ('Program', 'Program-specific funding', 2),
  ('Capital', 'Capital improvements and equipment', 3),
  ('Expansion', 'Geographic or service expansion', 4),
  ('Pilot', 'Pilot programs and proof of concept', 5);

-- Enable RLS
ALTER TABLE public.grant_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for grant_types (same pattern as sectors)
CREATE POLICY "Admins can manage grant types"
  ON public.grant_types FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view grant types"
  ON public.grant_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3) CREATE MAIN TABLE: grants
-- =============================================

CREATE TABLE public.grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id text NOT NULL UNIQUE,
  
  -- Core fields
  grant_name text NOT NULL,
  funder_name text NOT NULL,
  funder_type public.funder_type NOT NULL DEFAULT 'Other',
  
  -- Star rating
  star_rating integer NOT NULL DEFAULT 3 CHECK (star_rating >= 1 AND star_rating <= 5),
  
  -- Relationships
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  metro_id uuid REFERENCES public.metros(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  
  -- Pipeline
  stage public.grant_stage NOT NULL DEFAULT 'Researching',
  stage_entry_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.grant_status NOT NULL DEFAULT 'Active',
  
  -- Amounts & Timing
  amount_requested numeric(12, 2),
  amount_awarded numeric(12, 2),
  fiscal_year integer,
  grant_term_start date,
  grant_term_end date,
  is_multiyear boolean DEFAULT false,
  
  -- Strategy tagging (array of names for flexibility)
  grant_types text[] DEFAULT '{}',
  strategic_focus text[] DEFAULT '{}',
  
  -- Requirements
  match_required boolean DEFAULT false,
  reporting_required boolean DEFAULT false,
  reporting_frequency public.reporting_frequency,
  
  -- Notes
  notes text,
  internal_strategy_notes text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;

-- RLS policies for grants (following opportunities pattern)
CREATE POLICY "Admins and leadership can view all grants"
  ON public.grants FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Users can view grants they own or in their metros"
  ON public.grants FOR SELECT
  USING (
    owner_id = auth.uid() 
    OR has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Admins and leadership can manage all grants"
  ON public.grants FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Users can create grants in assigned metros"
  ON public.grants FOR INSERT
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "Users can update their own grants"
  ON public.grants FOR UPDATE
  USING (
    has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    OR (owner_id = auth.uid() AND has_metro_access(auth.uid(), metro_id))
  );

CREATE POLICY "Admins can delete grants"
  ON public.grants FOR DELETE
  USING (has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- 4) CREATE TABLE: grant_activities
-- =============================================

CREATE TABLE public.grant_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text NOT NULL UNIQUE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  activity_type public.grant_activity_type NOT NULL,
  activity_date timestamptz NOT NULL,
  notes text,
  next_action text,
  next_action_due timestamptz,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grant_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for grant_activities (inherit from parent grant)
CREATE POLICY "Users can view grant activities for accessible grants"
  ON public.grant_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = grant_activities.grant_id
      AND (
        has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
        OR g.owner_id = auth.uid()
        OR has_metro_access(auth.uid(), g.metro_id)
      )
    )
  );

CREATE POLICY "Users can manage grant activities for accessible grants"
  ON public.grant_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = grant_activities.grant_id
      AND (
        has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
        OR g.owner_id = auth.uid()
        OR has_metro_access(auth.uid(), g.metro_id)
      )
    )
  );

-- 5) TRIGGERS
-- =============================================

-- Auto-update stage_entry_date when stage changes
CREATE OR REPLACE FUNCTION public.update_grant_stage_entry_date()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_entry_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_grant_stage_entry_date
  BEFORE UPDATE ON public.grants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grant_stage_entry_date();

-- Auto-update updated_at timestamp
CREATE TRIGGER update_grants_updated_at
  BEFORE UPDATE ON public.grants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grant_types_updated_at
  BEFORE UPDATE ON public.grant_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grant_activities_updated_at
  BEFORE UPDATE ON public.grant_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) INDEXES
-- =============================================

CREATE INDEX idx_grants_owner_id ON public.grants(owner_id);
CREATE INDEX idx_grants_metro_id ON public.grants(metro_id);
CREATE INDEX idx_grants_opportunity_id ON public.grants(opportunity_id);
CREATE INDEX idx_grants_stage ON public.grants(stage);
CREATE INDEX idx_grants_status ON public.grants(status);
CREATE INDEX idx_grants_funder_type ON public.grants(funder_type);
CREATE INDEX idx_grants_star_rating ON public.grants(star_rating);
CREATE INDEX idx_grant_activities_grant_id ON public.grant_activities(grant_id);
CREATE INDEX idx_grant_activities_activity_date ON public.grant_activities(activity_date);