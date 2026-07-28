
-- Add public event page fields to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS capacity integer;

-- Add branding fields to tenants for public-facing pages
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#6366f1';
