-- Add canonical chapter labels to the opportunity_stage enum
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'Found';
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'First Conversation';
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'Discovery';
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'Pricing Shared';
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'Account Setup';
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'First Devices';
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'Growing Together';
ALTER TYPE public.opportunity_stage ADD VALUE IF NOT EXISTS 'Not the Right Time';