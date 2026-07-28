DROP POLICY IF EXISTS "lps_insert_own" ON public.local_pulse_sources;

CREATE POLICY "lps_insert_own"
ON public.local_pulse_sources
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);