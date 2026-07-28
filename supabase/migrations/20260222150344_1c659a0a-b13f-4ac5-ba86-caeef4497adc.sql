
-- Add compliance_posture to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS compliance_posture text NOT NULL DEFAULT 'standard';

-- Add family fields to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS has_family boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS family_members jsonb;
