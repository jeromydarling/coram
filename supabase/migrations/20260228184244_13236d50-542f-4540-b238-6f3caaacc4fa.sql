-- Phase 26D: Add foundational flag to providence_reports
ALTER TABLE public.providence_reports
ADD COLUMN IF NOT EXISTS foundational BOOLEAN NOT NULL DEFAULT false;