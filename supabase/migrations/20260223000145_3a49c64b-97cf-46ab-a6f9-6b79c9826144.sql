-- Phase 21D: Narrative Gravity Engine
-- Add gravity fields to operator_content_drafts
ALTER TABLE public.operator_content_drafts
  ADD COLUMN IF NOT EXISTS gravity_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_anchor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anchor_archetypes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS anchor_reason text;

-- Index for anchor queries
CREATE INDEX IF NOT EXISTS idx_content_drafts_anchor
  ON public.operator_content_drafts (is_anchor)
  WHERE is_anchor = true;