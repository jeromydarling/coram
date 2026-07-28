
CREATE TABLE public.content_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id text NOT NULL,
  tenant_id uuid NOT NULL,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'public_page',
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_content_report_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'reviewed', 'dismissed', 'actioned') THEN
    RAISE EXCEPTION 'Invalid content_reports status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_content_report_status
BEFORE INSERT OR UPDATE ON public.content_reports
FOR EACH ROW EXECUTE FUNCTION public.validate_content_report_status();

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit content reports"
ON public.content_reports FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view content reports"
ON public.content_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'leadership')
  )
);

CREATE POLICY "Admins can update content reports"
ON public.content_reports FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'leadership')
  )
);
