
-- Test: simplest policies first
CREATE POLICY "lps_select_own"
  ON public.local_pulse_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "lps_update_own"
  ON public.local_pulse_sources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "lps_delete_own"
  ON public.local_pulse_sources FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "er_select_author"
  ON public.event_reflections FOR SELECT
  USING (auth.uid() = author_id);

CREATE POLICY "er_update_author"
  ON public.event_reflections FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "er_delete_author"
  ON public.event_reflections FOR DELETE
  USING (auth.uid() = author_id);
