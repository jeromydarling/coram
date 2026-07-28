
-- Create opportunity_reflections table
CREATE TABLE public.opportunity_reflections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opp_reflections_opp_created ON public.opportunity_reflections (opportunity_id, created_at DESC);
CREATE INDEX idx_opp_reflections_author_created ON public.opportunity_reflections (author_id, created_at DESC);

ALTER TABLE public.opportunity_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read own reflections"
  ON public.opportunity_reflections FOR SELECT
  USING (author_id = auth.uid());

CREATE POLICY "Team reflections visible with metro access"
  ON public.opportunity_reflections FOR SELECT
  USING (
    visibility = 'team'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_reflections.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "Users with metro access can add reflections"
  ON public.opportunity_reflections FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_reflections.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "Authors can update own reflections"
  ON public.opportunity_reflections FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Admin can update any reflection"
  ON public.opportunity_reflections FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Authors can delete own reflections"
  ON public.opportunity_reflections FOR DELETE
  USING (author_id = auth.uid());

CREATE POLICY "Admin can delete any reflection"
  ON public.opportunity_reflections FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE TRIGGER update_opp_reflections_updated_at
  BEFORE UPDATE ON public.opportunity_reflections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
