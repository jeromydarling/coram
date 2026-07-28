-- Create ENUMs for type safety
CREATE TYPE public.metro_status AS ENUM ('Expansion Ready', 'Anchor Build', 'Ecosystem Dev');
CREATE TYPE public.recommendation AS ENUM ('Invest', 'Build Anchors', 'Hold', 'Triage');
CREATE TYPE public.opportunity_stage AS ENUM (
  'Target Identified', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Agreement Pending', 'Agreement Signed', 'First Volume',
  'Stable Producer', 'Closed - Not a Fit'
);
CREATE TYPE public.opportunity_status AS ENUM ('Active', 'On Hold', 'Closed - Won', 'Closed - Lost');
CREATE TYPE public.partner_tier AS ENUM ('Anchor', 'Distribution', 'Referral', 'Workforce', 'Housing', 'Education', 'Other');
CREATE TYPE public.activity_type AS ENUM ('Call', 'Email', 'Meeting', 'Event', 'Site Visit', 'Intro', 'Other');
CREATE TYPE public.activity_outcome AS ENUM ('Connected', 'No Response', 'Follow-up Needed', 'Moved Stage', 'Not a Fit');
CREATE TYPE public.event_type AS ENUM ('Distribution', 'Sign-up', 'Tabling', 'Workshop', 'Partner Event', 'Other');
CREATE TYPE public.grant_narrative_value AS ENUM ('High', 'Medium', 'Low');
CREATE TYPE public.pipeline_stage AS ENUM (
  'Target Identified', 'Contacted', 'Discovery Held', 'Proposal Sent',
  'Agreement Pending', 'Agreement Signed', 'First Volume'
);
CREATE TYPE public.anchor_tier AS ENUM ('Strategic', 'Standard', 'Pilot');
CREATE TYPE public.growth_trend AS ENUM ('Up', 'Flat', 'Down');
CREATE TYPE public.risk_level AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE public.production_status AS ENUM ('Pre-Production', 'Ramp', 'Stable', 'Scale');

-- Metros table (Master)
CREATE TABLE public.metros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id TEXT UNIQUE NOT NULL,
  metro TEXT NOT NULL,
  referrals_per_month INTEGER DEFAULT 0,
  partner_inquiries_per_month INTEGER DEFAULT 0,
  waitlist_size INTEGER DEFAULT 0,
  distribution_partner_yn BOOLEAN DEFAULT false,
  storage_ready_yn BOOLEAN DEFAULT false,
  staff_coverage_1to5 INTEGER DEFAULT 1 CHECK (staff_coverage_1to5 >= 1 AND staff_coverage_1to5 <= 5),
  workforce_partners INTEGER DEFAULT 0,
  housing_refugee_partners INTEGER DEFAULT 0,
  schools_libraries INTEGER DEFAULT 0,
  recommendation public.recommendation DEFAULT 'Hold',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Opportunities table (Core CRM)
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT UNIQUE NOT NULL,
  organization TEXT NOT NULL,
  metro_id UUID REFERENCES public.metros(id) ON DELETE SET NULL,
  stage public.opportunity_stage DEFAULT 'Target Identified',
  status public.opportunity_status DEFAULT 'Active',
  partner_tier public.partner_tier DEFAULT 'Other',
  grant_alignment TEXT[], -- Array of grant alignment values
  mission_snapshot TEXT,
  best_partnership_angle TEXT,
  primary_contact_name TEXT,
  primary_contact_title TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  last_contact_date DATE,
  next_action_due TIMESTAMPTZ,
  next_step TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT UNIQUE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT UNIQUE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  metro_id UUID REFERENCES public.metros(id) ON DELETE SET NULL,
  activity_date_time TIMESTAMPTZ NOT NULL,
  activity_type public.activity_type NOT NULL,
  outcome public.activity_outcome,
  notes TEXT,
  next_action TEXT,
  next_action_due TIMESTAMPTZ,
  stage_suggested public.opportunity_stage,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  metro_id UUID REFERENCES public.metros(id) ON DELETE SET NULL,
  host_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  event_type public.event_type NOT NULL,
  staff_deployed INTEGER DEFAULT 0,
  households_served INTEGER DEFAULT 0,
  devices_distributed INTEGER DEFAULT 0,
  internet_signups INTEGER DEFAULT 0,
  referrals_generated INTEGER DEFAULT 0,
  cost_estimated DECIMAL(10,2) DEFAULT 0,
  anchor_identified_yn BOOLEAN DEFAULT false,
  followup_meeting_yn BOOLEAN DEFAULT false,
  grant_narrative_value public.grant_narrative_value DEFAULT 'Medium',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Anchor Pipeline table
CREATE TABLE public.anchor_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_pipeline_id TEXT UNIQUE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  metro_id UUID REFERENCES public.metros(id) ON DELETE SET NULL,
  owner TEXT,
  stage public.pipeline_stage DEFAULT 'Target Identified',
  stage_entry_date DATE DEFAULT CURRENT_DATE,
  last_activity_date DATE,
  next_action TEXT,
  next_action_due TIMESTAMPTZ,
  expected_anchor_yn BOOLEAN DEFAULT false,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  target_first_volume_date DATE,
  estimated_monthly_volume INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Anchors table
CREATE TABLE public.anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_id TEXT UNIQUE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  metro_id UUID REFERENCES public.metros(id) ON DELETE SET NULL,
  anchor_tier public.anchor_tier DEFAULT 'Standard',
  first_contact_date DATE,
  discovery_date DATE,
  agreement_signed_date DATE,
  first_volume_date DATE,
  stable_producer_date DATE,
  last_30_day_volume INTEGER DEFAULT 0,
  avg_monthly_volume INTEGER DEFAULT 0,
  peak_monthly_volume INTEGER DEFAULT 0,
  growth_trend public.growth_trend DEFAULT 'Flat',
  risk_level public.risk_level DEFAULT 'Medium',
  strategic_value_1to5 INTEGER DEFAULT 3 CHECK (strategic_value_1to5 >= 1 AND strategic_value_1to5 <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.metros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchors ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies (no auth required for now)
CREATE POLICY "Allow all select on metros" ON public.metros FOR SELECT USING (true);
CREATE POLICY "Allow all insert on metros" ON public.metros FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on metros" ON public.metros FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on metros" ON public.metros FOR DELETE USING (true);

CREATE POLICY "Allow all select on opportunities" ON public.opportunities FOR SELECT USING (true);
CREATE POLICY "Allow all insert on opportunities" ON public.opportunities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on opportunities" ON public.opportunities FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on opportunities" ON public.opportunities FOR DELETE USING (true);

CREATE POLICY "Allow all select on contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Allow all insert on contacts" ON public.contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on contacts" ON public.contacts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on contacts" ON public.contacts FOR DELETE USING (true);

CREATE POLICY "Allow all select on activities" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Allow all insert on activities" ON public.activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on activities" ON public.activities FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on activities" ON public.activities FOR DELETE USING (true);

CREATE POLICY "Allow all select on events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow all insert on events" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on events" ON public.events FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on events" ON public.events FOR DELETE USING (true);

CREATE POLICY "Allow all select on anchor_pipeline" ON public.anchor_pipeline FOR SELECT USING (true);
CREATE POLICY "Allow all insert on anchor_pipeline" ON public.anchor_pipeline FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on anchor_pipeline" ON public.anchor_pipeline FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on anchor_pipeline" ON public.anchor_pipeline FOR DELETE USING (true);

CREATE POLICY "Allow all select on anchors" ON public.anchors FOR SELECT USING (true);
CREATE POLICY "Allow all insert on anchors" ON public.anchors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on anchors" ON public.anchors FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on anchors" ON public.anchors FOR DELETE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_metros_updated_at BEFORE UPDATE ON public.metros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_anchor_pipeline_updated_at BEFORE UPDATE ON public.anchor_pipeline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_anchors_updated_at BEFORE UPDATE ON public.anchors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();