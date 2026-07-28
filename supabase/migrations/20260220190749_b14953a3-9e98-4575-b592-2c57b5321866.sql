
-- Phase 8A: Civitas™ as a paid add-on
-- Add home_metro_id to tenants for single-community fallback
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS home_metro_id uuid REFERENCES public.metros(id);

-- Add civitas_enabled to tenants for direct flag checking
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS civitas_enabled boolean NOT NULL DEFAULT false;

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_tenants_civitas_enabled ON public.tenants(civitas_enabled);
