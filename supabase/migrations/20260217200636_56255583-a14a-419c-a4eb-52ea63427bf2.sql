
-- Add 'new_opportunity' to the allowed suggestion_type values
ALTER TABLE public.ai_suggestions DROP CONSTRAINT ai_suggestions_suggestion_type_check;

ALTER TABLE public.ai_suggestions ADD CONSTRAINT ai_suggestions_suggestion_type_check
  CHECK (suggestion_type = ANY (ARRAY['new_contact'::text, 'new_opportunity'::text, 'task'::text, 'followup'::text, 'stage_change'::text]));
