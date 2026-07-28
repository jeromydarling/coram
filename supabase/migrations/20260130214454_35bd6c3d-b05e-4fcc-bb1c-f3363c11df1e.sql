
-- Update claim_emails_for_analysis to analyze ALL emails, not just those with linked contacts
-- This enables the AI to suggest NEW contacts from unknown senders

CREATE OR REPLACE FUNCTION public.claim_emails_for_analysis(
  p_user_id uuid, 
  p_run_id uuid, 
  p_cutoff timestamp with time zone, 
  p_limit integer DEFAULT 50
)
RETURNS SETOF email_communications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clamped_limit INTEGER;
BEGIN
  v_clamped_limit := LEAST(COALESCE(p_limit, 50), 50);
  
  RETURN QUERY
  UPDATE email_communications
  SET ai_run_id = p_run_id,
      updated_at = now()
  WHERE id IN (
    SELECT id FROM email_communications
    WHERE user_id = p_user_id
      -- Removed: AND contact_id IS NOT NULL
      -- Now analyzes ALL emails to suggest new contacts
      AND ai_analyzed_at IS NULL
      AND ai_run_id IS NULL
      AND sent_at >= p_cutoff
    ORDER BY sent_at DESC
    LIMIT v_clamped_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$function$;

COMMENT ON FUNCTION public.claim_emails_for_analysis IS 
  'Claims unanalyzed emails for AI processing. Analyzes all emails (not just linked contacts) to enable new contact suggestions.';
