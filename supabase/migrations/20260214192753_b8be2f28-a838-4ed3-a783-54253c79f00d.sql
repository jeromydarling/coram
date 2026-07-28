
-- Email task suggestions: draft action items extracted from sent emails
CREATE TABLE public.email_task_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  email_id uuid NOT NULL,
  email_thread_id text NULL,
  suggested_title text NOT NULL,
  suggested_description text NULL,
  suggested_due_date date NULL,
  confidence numeric NULL,
  extracted_spans jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  dedupe_key text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_task_suggestions
  ADD CONSTRAINT email_task_suggestions_status_check CHECK (status IN ('pending','accepted','dismissed'));

CREATE INDEX idx_email_task_suggestions_opp ON public.email_task_suggestions (opportunity_id, created_at DESC);
CREATE UNIQUE INDEX idx_email_task_suggestions_dedupe ON public.email_task_suggestions (dedupe_key);

ALTER TABLE public.email_task_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metro_access_select_suggestions"
  ON public.email_task_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = email_task_suggestions.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "metro_access_insert_suggestions"
  ON public.email_task_suggestions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = email_task_suggestions.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

CREATE POLICY "metro_access_update_suggestions"
  ON public.email_task_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = email_task_suggestions.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );
