
-- Add category column to existing sectors table
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS category text;

-- Create tenant_sectors junction table
CREATE TABLE IF NOT EXISTS public.tenant_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sector_id)
);

-- RLS for tenant_sectors
ALTER TABLE public.tenant_sectors ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own sector assignments
CREATE POLICY "Tenants can view own sectors"
  ON public.tenant_sectors FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Tenants can manage their own sector assignments
CREATE POLICY "Tenants can insert own sectors"
  ON public.tenant_sectors FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own sectors"
  ON public.tenant_sectors FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Gardener (admin role) read-only on tenant_sectors
CREATE POLICY "Gardeners can view all tenant sectors"
  ON public.tenant_sectors FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Everyone authenticated can read the sectors catalog
CREATE POLICY "Authenticated users can read sectors"
  ON public.sectors FOR SELECT
  TO authenticated
  USING (true);

-- Seed default sectors
INSERT INTO public.sectors (name, category, description, color, is_active, sort_order) VALUES
  ('Housing & Shelter', 'Human Services', 'Housing stability, shelters, eviction prevention', '#8B5CF6', true, 1),
  ('Digital Inclusion', 'Technology', 'Internet access, device distribution, digital literacy', '#3B82F6', true, 2),
  ('Workforce Development', 'Economic', 'Job training, employment services, career pathways', '#F59E0B', true, 3),
  ('Youth & Education', 'Education', 'K-12 programs, tutoring, after-school, youth development', '#10B981', true, 4),
  ('Food & Nutrition', 'Human Services', 'Food pantries, meal programs, nutrition assistance', '#EF4444', true, 5),
  ('Health & Wellness', 'Healthcare', 'Clinics, mental health, addiction recovery, wellness', '#EC4899', true, 6),
  ('Refugee & Immigration', 'Human Services', 'Resettlement, legal aid, language services', '#6366F1', true, 7),
  ('Faith & Spiritual Care', 'Community', 'Pastoral care, spiritual formation, faith communities', '#A855F7', true, 8),
  ('Elder Care', 'Human Services', 'Senior services, aging in place, companionship', '#F97316', true, 9),
  ('Justice & Reentry', 'Justice', 'Reentry support, legal aid, restorative justice', '#64748B', true, 10),
  ('Environmental & Land', 'Environment', 'Community gardens, sustainability, land stewardship', '#22C55E', true, 11),
  ('Arts & Culture', 'Community', 'Creative arts, cultural preservation, community arts', '#D946EF', true, 12),
  ('Multi-sector / General', 'General', 'Cross-cutting work across multiple domains', '#94A3B8', true, 13)
ON CONFLICT (name) DO NOTHING;
