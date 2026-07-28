-- Allow foundational Providence generations
ALTER TABLE public.providence_reports
DROP CONSTRAINT IF EXISTS providence_reports_trigger_type_check;

ALTER TABLE public.providence_reports
ADD CONSTRAINT providence_reports_trigger_type_check
CHECK (
  trigger_type = ANY (
    ARRAY['quarterly'::text, 'arc_shift'::text, 'manual'::text, 'foundational'::text]
  )
);