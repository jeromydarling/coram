-- ============================================================
-- PROFUNDA AI SYSTEM - DATABASE MIGRATION (Fixed)
-- All 15 safety and operational hardening rules implemented
-- ============================================================

-- 1.1 Create ai_user_settings Table
CREATE TABLE ai_user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Gmail connection timestamps
  gmail_connected_at TIMESTAMPTZ,
  gmail_ai_enabled BOOLEAN DEFAULT false,
  gmail_ai_enabled_at TIMESTAMPTZ,  -- IMMUTABLE after first set
  gmail_ai_start_at TIMESTAMPTZ,    -- Legacy, NOT used for cutoff
  gmail_last_token_refresh_at TIMESTAMPTZ,
  
  -- Thresholds
  auto_approve_threshold NUMERIC(4,3) DEFAULT 0.95,
  
  -- OCR settings
  ocr_auto_followup_enabled BOOLEAN DEFAULT true,
  ocr_followup_business_days INTEGER DEFAULT 3,
  
  -- Chat settings
  chat_context_window INTEGER DEFAULT 20,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document immutability (RULE 1)
COMMENT ON COLUMN ai_user_settings.gmail_ai_enabled_at IS 
  'Forward-only cutoff. Once set, NEVER update. All email analysis uses sent_at >= this value.';

ALTER TABLE ai_user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own AI settings" ON ai_user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 1.2 Create ai_suggestions Table
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  source TEXT NOT NULL CHECK (source IN ('chat', 'email_analysis', 'ocr')),
  source_id TEXT,
  source_snippet TEXT,
  
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'new_contact', 'task', 'followup', 'stage_change'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'approved', 'dismissed', 'auto_approved', 'failed'
  )),
  
  depends_on_suggestion_id UUID REFERENCES ai_suggestions(id) ON DELETE SET NULL,
  
  -- Contact fields
  suggested_name TEXT,
  suggested_email TEXT,
  suggested_phone TEXT,
  suggested_title TEXT,
  suggested_organization TEXT,
  suggested_opportunity_id UUID,
  
  -- Task fields
  task_title TEXT,
  task_description TEXT,
  task_due_date DATE,
  task_priority TEXT CHECK (task_priority IS NULL OR task_priority IN ('low', 'medium', 'high')),
  linked_contact_id UUID,
  
  -- Follow-up fields
  followup_reason TEXT,
  followup_contact_id UUID,
  days_since_contact INTEGER,
  
  -- AI metadata
  confidence_score NUMERIC(4,3) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  ai_reasoning TEXT CHECK (ai_reasoning IS NULL OR char_length(ai_reasoning) <= 200),
  
  -- Learning data (ONLY for email_analysis, NULL for ocr/chat) [RULE 5]
  sender_email TEXT,
  sender_domain TEXT,
  
  -- OCR batch
  ocr_batch_id UUID,
  
  -- SHA-256 hash (ONLY for email_analysis) [RULE 5]
  suggestion_hash TEXT,
  
  is_backfill BOOLEAN DEFAULT false,
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_entity_id UUID,
  created_entity_type TEXT CHECK (created_entity_type IS NULL OR created_entity_type IN ('contact', 'task', 'activity')),
  
  -- EXPLICIT CONSTRAINTS [RULE 7]
  CONSTRAINT email_suggestion_hash_required CHECK (
    source <> 'email_analysis' OR suggestion_hash IS NOT NULL
  ),
  
  CONSTRAINT ocr_batch_id_required CHECK (
    source <> 'ocr' OR ocr_batch_id IS NOT NULL
  )
);

-- Email unique constraint [RULE 5]
CREATE UNIQUE INDEX idx_ai_suggestions_email_dedup
ON ai_suggestions (user_id, source, source_id, suggestion_type, suggestion_hash, is_backfill)
WHERE source = 'email_analysis';

-- OCR unique constraint [RULE 7]
CREATE UNIQUE INDEX idx_ai_suggestions_ocr_dedup
ON ai_suggestions (user_id, ocr_batch_id, suggestion_type)
WHERE source = 'ocr';

-- Pagination index [RULE 12]
CREATE INDEX idx_ai_suggestions_user_source_status_created
ON ai_suggestions (user_id, source, status, created_at DESC);

-- Stale processing recovery index [RULE 11]
CREATE INDEX idx_ai_suggestions_stale_processing
ON ai_suggestions (status, updated_at)
WHERE status = 'processing';

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suggestions" ON ai_suggestions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER ai_suggestions_updated_at
BEFORE UPDATE ON ai_suggestions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 1.3 Create ai_analysis_runs Table
CREATE TABLE ai_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'selective', 'scheduled', 'ocr')),
  emails_analyzed INTEGER DEFAULT 0,
  suggestions_created INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  auto_approved_count INTEGER DEFAULT 0,
  ocr_images_processed INTEGER,
  ocr_batch_id UUID,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout'))
);

ALTER TABLE ai_analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own runs" ON ai_analysis_runs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 1.4 Create ai_sender_patterns Table
CREATE TABLE ai_sender_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('email', 'domain')),
  pattern_value TEXT NOT NULL,
  total_suggestions INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  dismissed_count INTEGER DEFAULT 0,
  approval_rate NUMERIC(4,3),
  auto_approve_threshold NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, pattern_type, pattern_value)
);

ALTER TABLE ai_sender_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own patterns" ON ai_sender_patterns
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 1.5 Create ai_chat_sessions Table
CREATE TABLE ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat sessions" ON ai_chat_sessions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 1.6 Create ai_chat_messages Table
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat messages" ON ai_chat_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid())
  );

-- 1.7 Modify email_communications Table - ADD updated_at FIRST
ALTER TABLE email_communications
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE email_communications
ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_run_id UUID;

-- Index for stale claim recovery [RULE 2]
CREATE INDEX IF NOT EXISTS idx_email_communications_stale_claims
ON email_communications(user_id, ai_run_id, updated_at)
WHERE ai_analyzed_at IS NULL AND ai_run_id IS NOT NULL;

-- Index for atomic claiming [RULE 1]
CREATE INDEX IF NOT EXISTS idx_email_communications_analysis_claim
ON email_communications(user_id, contact_id, sent_at DESC)
WHERE contact_id IS NOT NULL 
  AND ai_analyzed_at IS NULL 
  AND ai_run_id IS NULL;

-- ============================================================
-- SQL FUNCTIONS (RPCs)
-- ============================================================

-- Reset stale email claims [RULE 2]
CREATE OR REPLACE FUNCTION reset_stale_email_claims(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE email_communications
  SET ai_run_id = NULL,
      updated_at = now()
  WHERE user_id = p_user_id
    AND ai_analyzed_at IS NULL
    AND ai_run_id IS NOT NULL
    AND updated_at < now() - interval '10 minutes';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION reset_stale_email_claims IS
  'RULE 2: Clears ai_run_id for emails stuck > 10 minutes. Only affects unanalyzed emails.';

-- Reset stale processing suggestions [RULE 11]
CREATE OR REPLACE FUNCTION reset_stale_processing_suggestions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE ai_suggestions
  SET status = 'pending',
      updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'processing'
    AND updated_at < now() - interval '5 minutes';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION reset_stale_processing_suggestions IS
  'RULE 11: Moves suggestions stuck in processing > 5 minutes back to pending.';

-- Atomic email claiming [RULE 1, 2]
CREATE OR REPLACE FUNCTION claim_emails_for_analysis(
  p_user_id UUID,
  p_run_id UUID,
  p_cutoff TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 50
)
RETURNS SETOF email_communications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      AND contact_id IS NOT NULL
      AND ai_analyzed_at IS NULL
      AND ai_run_id IS NULL
      AND sent_at >= p_cutoff
    ORDER BY sent_at DESC
    LIMIT v_clamped_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

COMMENT ON FUNCTION claim_emails_for_analysis IS
  'RULE 1: p_cutoff MUST be ai_user_settings.gmail_ai_enabled_at. Never use gmail_connected_at or gmail_ai_start_at.';

-- Enable Gmail AI safely [RULE 15]
CREATE OR REPLACE FUNCTION enable_gmail_ai(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_user_settings
  SET 
    gmail_ai_enabled = true,
    gmail_ai_enabled_at = COALESCE(gmail_ai_enabled_at, now()),
    updated_at = now()
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION enable_gmail_ai IS
  'RULE 15: gmail_ai_enabled_at is set ONCE via COALESCE. Never overwrites existing value.';

-- Server-side stats [RULE 13]
CREATE OR REPLACE FUNCTION get_email_insights_stats(p_user_id UUID)
RETURNS TABLE(status TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    status,
    COUNT(*)::BIGINT as count
  FROM ai_suggestions
  WHERE user_id = p_user_id
    AND source = 'email_analysis'
    AND created_at >= now() - interval '90 days'
  GROUP BY status;
$$;

COMMENT ON FUNCTION get_email_insights_stats IS
  'RULE 13: Server-side aggregation of suggestion counts by status (last 90 days).';