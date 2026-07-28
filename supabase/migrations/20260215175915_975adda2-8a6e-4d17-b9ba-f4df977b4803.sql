
-- Test: has_metro_access in policy
CREATE POLICY "er_team_select"
  ON public.event_reflections FOR SELECT
  USING (
    visibility = 'team'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_reflections.event_id
        AND public.has_metro_access(auth.uid(), e.metro_id)
    )
  );
