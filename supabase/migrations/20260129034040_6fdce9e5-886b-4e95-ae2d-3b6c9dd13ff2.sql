-- Create junction table for grant-anchor relationships
CREATE TABLE public.grant_anchor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid REFERENCES public.grants(id) ON DELETE CASCADE NOT NULL,
  anchor_id uuid REFERENCES public.anchors(id) ON DELETE CASCADE NOT NULL,
  link_type text DEFAULT 'supported' CHECK (link_type IN ('funded', 'supported', 'influenced')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(grant_id, anchor_id)
);

-- Enable RLS
ALTER TABLE public.grant_anchor_links ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can view all links
CREATE POLICY "Authenticated users can view grant anchor links"
  ON public.grant_anchor_links FOR SELECT TO authenticated USING (true);

-- Users can manage links for grants/anchors they have access to
CREATE POLICY "Users can manage grant anchor links"
  ON public.grant_anchor_links FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = grant_anchor_links.grant_id
      AND (g.owner_id = auth.uid() OR has_metro_access(auth.uid(), g.metro_id))
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_grant_anchor_links_updated_at
  BEFORE UPDATE ON public.grant_anchor_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();