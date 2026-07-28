-- Create separate write-only table for webhook keys
-- Users can only INSERT/UPDATE their key, never SELECT it
CREATE TABLE public.webhook_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  readai_key uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_keys ENABLE ROW LEVEL SECURITY;

-- CRITICAL: No SELECT policy - keys are write-only for users
-- Only service role can read keys (for webhook validation)

-- Allow users to insert their own key row
CREATE POLICY "Users can create own webhook key"
  ON public.webhook_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update (regenerate) their own key
CREATE POLICY "Users can update own webhook key"
  ON public.webhook_keys
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_webhook_keys_updated_at
  BEFORE UPDATE ON public.webhook_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing keys from ai_user_settings to new table
INSERT INTO public.webhook_keys (user_id, readai_key, created_at, updated_at)
SELECT 
  user_id,
  readai_webhook_key::uuid,
  created_at,
  updated_at
FROM public.ai_user_settings
WHERE readai_webhook_key IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Create a function to regenerate the webhook key (returns nothing to user)
CREATE OR REPLACE FUNCTION public.regenerate_webhook_key(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure user can only regenerate their own key
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot regenerate another user''s webhook key';
  END IF;
  
  -- Upsert: create if not exists, otherwise update
  INSERT INTO public.webhook_keys (user_id, readai_key, updated_at)
  VALUES (p_user_id, gen_random_uuid(), now())
  ON CONFLICT (user_id) 
  DO UPDATE SET readai_key = gen_random_uuid(), updated_at = now();
END;
$$;

-- Create a function to check if user has a webhook key configured (doesn't expose the key)
CREATE OR REPLACE FUNCTION public.has_webhook_key(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.webhook_keys
    WHERE user_id = p_user_id
  );
$$;

-- Create a function to get the webhook URL (key is returned only once on creation/regeneration)
-- This is called by the edge function with service role, not by users
CREATE OR REPLACE FUNCTION public.validate_webhook_key(p_key uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.webhook_keys WHERE readai_key = p_key;
$$;