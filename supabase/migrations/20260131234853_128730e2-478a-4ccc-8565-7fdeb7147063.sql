-- 1. Rate Limiting Table
CREATE TABLE public.edge_function_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, function_name, window_start)
);

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rate_limits_window ON public.edge_function_rate_limits (window_start);

-- RLS: Only service role can access (edge functions use service role)
CREATE POLICY "Service role only" ON public.edge_function_rate_limits
  FOR ALL USING (false);

-- 2. Rate Limit RPC with Guardrails
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_user_id UUID,
  p_function_name TEXT,
  p_window_minutes INTEGER,
  p_max_requests INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  -- Guardrails
  IF p_window_minutes <= 0 THEN
    RAISE EXCEPTION 'p_window_minutes must be > 0';
  END IF;
  
  IF p_max_requests <= 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Epoch-based bucketing for consistent windows
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );
  
  -- Atomic UPSERT with conflict handling
  INSERT INTO edge_function_rate_limits (user_id, function_name, window_start, request_count)
  VALUES (p_user_id, p_function_name, v_window_start, 1)
  ON CONFLICT (user_id, function_name, window_start)
  DO UPDATE SET request_count = edge_function_rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  -- Return TRUE if within limit, FALSE if exceeded
  RETURN v_current_count <= p_max_requests;
END;
$$;

-- 3. ai_suggestions RLS Overhaul
-- Drop existing broad policy
DROP POLICY IF EXISTS "Users manage own suggestions" ON public.ai_suggestions;

-- SELECT: Users can view their own suggestions
CREATE POLICY "Users can select own suggestions" ON public.ai_suggestions
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Users can create their own suggestions
CREATE POLICY "Users can insert own suggestions" ON public.ai_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update pending suggestions
CREATE POLICY "Users can update pending suggestions" ON public.ai_suggestions
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- DELETE: Users can only delete pending or dismissed suggestions (hard delete)
CREATE POLICY "Users can delete pending or dismissed suggestions" ON public.ai_suggestions
  FOR DELETE USING (auth.uid() = user_id AND status IN ('pending', 'dismissed'));