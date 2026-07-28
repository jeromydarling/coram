
-- Fix overly permissive RLS on campaign_subject_stats: restrict to service role only
DROP POLICY IF EXISTS "Service role can manage subject stats" ON public.campaign_subject_stats;

-- Replace with: no direct user writes (service role bypasses RLS anyway)
-- So we just need the SELECT policy which already exists.

-- Fix security definer view: mark as security invoker
ALTER VIEW public.resend_candidates_v1 SET (security_invoker = on);
