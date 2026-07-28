
-- Fix Check #1: Tighten public essay read policy to require published_at
DROP POLICY "Public can read published essays" ON public.library_essays;

CREATE POLICY "Public can read published essays"
  ON public.library_essays FOR SELECT
  USING (status = 'published' AND published_at IS NOT NULL);
