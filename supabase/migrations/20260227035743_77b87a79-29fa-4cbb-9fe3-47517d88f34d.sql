
-- Mission Atlas Drafts table for AI-generated atlas entries awaiting Gardener review
CREATE TABLE public.mission_atlas_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  archetype text NOT NULL,
  metro_type text NOT NULL CHECK (metro_type IN ('urban', 'suburban', 'rural')),
  themes text[] NOT NULL DEFAULT '{}',
  signals text[] NOT NULL DEFAULT '{}',
  roles text[] NOT NULL DEFAULT '{}',
  narrative text NOT NULL DEFAULT '',
  week_link text,
  research_context jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  generated_by text NOT NULL DEFAULT 'edge_function',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (archetype, metro_type, status)
);

ALTER TABLE public.mission_atlas_drafts ENABLE ROW LEVEL SECURITY;

-- Only admin/regional_lead (gardener roles) can access drafts
CREATE POLICY "Gardeners can view drafts"
  ON public.mission_atlas_drafts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'regional_lead'))
  );

CREATE POLICY "Gardeners can insert drafts"
  ON public.mission_atlas_drafts FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'regional_lead'))
  );

CREATE POLICY "Gardeners can update drafts"
  ON public.mission_atlas_drafts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'regional_lead'))
  );

CREATE POLICY "Gardeners can delete drafts"
  ON public.mission_atlas_drafts FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'regional_lead'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_mission_atlas_drafts_updated_at
  BEFORE UPDATE ON public.mission_atlas_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
