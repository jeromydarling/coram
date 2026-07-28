
-- INSERT policy with explicit column qualification
CREATE POLICY "er_insert_own"
  ON public.event_reflections FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_reflections.event_id
        AND public.has_metro_access(auth.uid(), e.metro_id)
    )
  );

-- Admin update/delete for reflections
CREATE POLICY "er_admin_update"
  ON public.event_reflections FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "er_admin_delete"
  ON public.event_reflections FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

-- Extraction SELECT with explicit qualification
CREATE POLICY "ere_select_visible"
  ON public.event_reflection_extractions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_reflections er
      WHERE er.id = event_reflection_extractions.reflection_id
        AND (
          er.author_id = auth.uid()
          OR (
            er.visibility = 'team'
            AND EXISTS (
              SELECT 1 FROM public.events e
              WHERE e.id = er.event_id
                AND public.has_metro_access(auth.uid(), e.metro_id)
            )
          )
        )
    )
  );

-- Admin select all pulse sources
CREATE POLICY "lps_admin_select"
  ON public.local_pulse_sources FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

-- INSERT policy for pulse sources with explicit qualification
CREATE POLICY "lps_insert_own"
  ON public.local_pulse_sources FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND metro_id = (SELECT p.home_metro_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- Pulse runs SELECT
CREATE POLICY "lpr_select_home"
  ON public.local_pulse_runs FOR SELECT
  USING (
    metro_id = (SELECT p.home_metro_id FROM public.profiles p WHERE p.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
  );
