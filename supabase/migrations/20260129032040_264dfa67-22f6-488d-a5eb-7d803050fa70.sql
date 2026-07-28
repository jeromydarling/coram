-- Create playbooks table for Regional Playbooks module
CREATE TABLE public.playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL, -- 'metro', 'anchor_type', 'grant_type', 'general'
  tags TEXT[] DEFAULT '{}',
  metro_id UUID REFERENCES public.metros(id) ON DELETE SET NULL,
  anchor_tier TEXT, -- Links to anchor types: Strategic, Standard, Pilot
  grant_type TEXT, -- Links to grant types from lookup
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view published playbooks
CREATE POLICY "Users can view published playbooks" 
ON public.playbooks 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_published = true);

-- Admins and leadership can manage all playbooks
CREATE POLICY "Admins can manage playbooks" 
ON public.playbooks 
FOR ALL 
USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- Create trigger for updated_at
CREATE TRIGGER update_playbooks_updated_at
BEFORE UPDATE ON public.playbooks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Add stale_flagged column to opportunities for auto-flagging
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS stale_flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stale_flagged_at TIMESTAMP WITH TIME ZONE;

-- Create function to auto-flag stale opportunities (>30 days no activity)
CREATE OR REPLACE FUNCTION public.flag_stale_opportunities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Flag opportunities with no activity in 30+ days that aren't already flagged
  UPDATE public.opportunities o
  SET 
    stale_flagged = true,
    stale_flagged_at = now()
  WHERE o.stale_flagged = false
    AND o.status = 'Active'
    AND o.last_contact_date < (CURRENT_DATE - INTERVAL '30 days')
    AND o.stage NOT IN ('Stable Producer', 'Closed - Not a Fit');
    
  -- Clear stale flag if activity happened recently
  UPDATE public.opportunities o
  SET 
    stale_flagged = false,
    stale_flagged_at = NULL
  WHERE o.stale_flagged = true
    AND o.last_contact_date >= (CURRENT_DATE - INTERVAL '30 days');
END;
$function$;

-- Create indexes for command center queries
CREATE INDEX IF NOT EXISTS idx_opportunities_stale ON public.opportunities(stale_flagged, status) WHERE stale_flagged = true;
CREATE INDEX IF NOT EXISTS idx_opportunities_next_action_due ON public.opportunities(next_action_due) WHERE next_action_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grants_stage_deadline ON public.grants(stage, grant_term_start) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_anchor_pipeline_stage ON public.anchor_pipeline(stage, probability) WHERE stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anchors_first_volume ON public.anchors(first_volume_date) WHERE first_volume_date IS NOT NULL;