-- Part 2: Create tables, security functions, and RLS policies

-- 1.3A Create brevo_metro_lists table (server-write only)
CREATE TABLE IF NOT EXISTS public.brevo_metro_lists (
  metro_id uuid PRIMARY KEY REFERENCES public.metros(id) ON DELETE CASCADE,
  brevo_list_id text NOT NULL UNIQUE,
  brevo_list_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.3B Create email_segments table (needed first for FK)
CREATE TABLE IF NOT EXISTS public.email_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  definition jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.3C Create email_campaigns table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  subject text NOT NULL,
  preheader text,
  html_body text,
  from_name text,
  from_email text,
  reply_to text,
  segment_id uuid NULL REFERENCES public.email_segments(id) ON DELETE SET NULL,
  status email_campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  audience_count int NOT NULL DEFAULT 0,
  brevo_list_id text,
  brevo_campaign_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.3D Create email_campaign_audience table (server-write only)
CREATE TABLE IF NOT EXISTS public.email_campaign_audience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text,
  opportunity_id uuid,
  source text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, email)
);

-- Create indexes for email_campaign_audience
CREATE INDEX IF NOT EXISTS idx_campaign_audience_campaign ON public.email_campaign_audience(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_audience_email ON public.email_campaign_audience(lower(email));

-- 1.3E Create email_campaign_events table (server-write only)
CREATE TABLE IF NOT EXISTS public.email_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for email_campaign_events
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON public.email_campaign_events(campaign_id);

-- 2.1 Create can_access_email_features function
CREATE OR REPLACE FUNCTION public.can_access_email_features(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'warehouse_manager'
  )
$$;

-- 2.2 Create owns_campaign function
CREATE OR REPLACE FUNCTION public.owns_campaign(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_campaigns
    WHERE id = _campaign_id AND created_by = _user_id
  )
$$;

-- 3.1 Enable RLS on brevo_metro_lists
ALTER TABLE public.brevo_metro_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brevo_metro_lists_select_non_warehouse" ON public.brevo_metro_lists;
CREATE POLICY "brevo_metro_lists_select_non_warehouse"
  ON public.brevo_metro_lists
  FOR SELECT
  USING (public.can_access_email_features(auth.uid()));

-- 3.2 Enable RLS on email_campaigns
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_campaigns_select_own" ON public.email_campaigns;
CREATE POLICY "email_campaigns_select_own"
  ON public.email_campaigns FOR SELECT
  USING (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "email_campaigns_insert_own" ON public.email_campaigns;
CREATE POLICY "email_campaigns_insert_own"
  ON public.email_campaigns FOR INSERT
  WITH CHECK (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "email_campaigns_update_own" ON public.email_campaigns;
CREATE POLICY "email_campaigns_update_own"
  ON public.email_campaigns FOR UPDATE
  USING (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "email_campaigns_delete_own" ON public.email_campaigns;
CREATE POLICY "email_campaigns_delete_own"
  ON public.email_campaigns FOR DELETE
  USING (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

-- 3.3 Enable RLS on email_segments
ALTER TABLE public.email_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_segments_select_own" ON public.email_segments;
CREATE POLICY "email_segments_select_own"
  ON public.email_segments FOR SELECT
  USING (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "email_segments_insert_own" ON public.email_segments;
CREATE POLICY "email_segments_insert_own"
  ON public.email_segments FOR INSERT
  WITH CHECK (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "email_segments_update_own" ON public.email_segments;
CREATE POLICY "email_segments_update_own"
  ON public.email_segments FOR UPDATE
  USING (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "email_segments_delete_own" ON public.email_segments;
CREATE POLICY "email_segments_delete_own"
  ON public.email_segments FOR DELETE
  USING (public.can_access_email_features(auth.uid()) AND created_by = auth.uid());

-- 3.4 Enable RLS on email_campaign_audience
ALTER TABLE public.email_campaign_audience ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_campaign_audience_select_own_campaign" ON public.email_campaign_audience;
CREATE POLICY "email_campaign_audience_select_own_campaign"
  ON public.email_campaign_audience FOR SELECT
  USING (public.can_access_email_features(auth.uid()) AND public.owns_campaign(auth.uid(), campaign_id));

-- 3.5 Enable RLS on email_campaign_events
ALTER TABLE public.email_campaign_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_campaign_events_select_own_campaign" ON public.email_campaign_events;
CREATE POLICY "email_campaign_events_select_own_campaign"
  ON public.email_campaign_events FOR SELECT
  USING (public.can_access_email_features(auth.uid()) AND public.owns_campaign(auth.uid(), campaign_id));