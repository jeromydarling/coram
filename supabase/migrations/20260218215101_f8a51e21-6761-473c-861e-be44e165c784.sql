
-- =====================================================
-- PHASE 7: Hotspots & Subscriptions Pricing Architecture
-- NEW tables only — does NOT modify existing catalog
-- =====================================================

-- 1) pricing_products
CREATE TABLE public.pricing_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('computer', 'accessory', 'hotspot_device', 'hotspot_plan')),
  network_type text NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) pricing_subscription_terms
CREATE TABLE public.pricing_subscription_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pricing_products(id) ON DELETE CASCADE,
  months integer NOT NULL,
  service_price_cents integer NOT NULL,
  bundle_price_cents integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_sub_terms_product_months ON public.pricing_subscription_terms(product_id, months);

-- Timestamp trigger for pricing_products
CREATE TRIGGER set_pricing_products_updated_at
  BEFORE UPDATE ON public.pricing_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.pricing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_subscription_terms ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (RIMs see pricing during provisioning)
CREATE POLICY "Authenticated users can read pricing products"
  ON public.pricing_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read subscription terms"
  ON public.pricing_subscription_terms FOR SELECT
  USING (auth.role() = 'authenticated');

-- Write: admin only
CREATE POLICY "Admins can manage pricing products"
  ON public.pricing_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage subscription terms"
  ON public.pricing_subscription_terms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- SEED DATA — 4 Hotspot Products + 24 Subscription Terms
-- =====================================================

-- Insert products
INSERT INTO public.pricing_products (id, name, category, product_type, network_type, display_order) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', '5G Hotspot — Premium',  'Hotspots & Connectivity', 'hotspot_device', '5G', 10),
  ('a1b2c3d4-0001-4000-8000-000000000002', '5G Hotspot — Standard', 'Hotspots & Connectivity', 'hotspot_device', '5G', 20),
  ('a1b2c3d4-0001-4000-8000-000000000003', '5G Hotspot — Entry',    'Hotspots & Connectivity', 'hotspot_device', '5G', 30),
  ('a1b2c3d4-0001-4000-8000-000000000004', '4G Hotspot',            'Hotspots & Connectivity', 'hotspot_device', '4G', 40);

-- 5G Premium terms
INSERT INTO public.pricing_subscription_terms (product_id, months, service_price_cents, bundle_price_cents) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001',  1,  1500, 10500),
  ('a1b2c3d4-0001-4000-8000-000000000001',  3,  4000, 13000),
  ('a1b2c3d4-0001-4000-8000-000000000001',  6,  7500, 16500),
  ('a1b2c3d4-0001-4000-8000-000000000001', 12, 13500, 22500),
  ('a1b2c3d4-0001-4000-8000-000000000001', 24, 26000, 35000),
  ('a1b2c3d4-0001-4000-8000-000000000001', 36, 36000, 45000);

-- 5G Standard terms
INSERT INTO public.pricing_subscription_terms (product_id, months, service_price_cents, bundle_price_cents) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000002',  1,  1500,  7900),
  ('a1b2c3d4-0001-4000-8000-000000000002',  3,  4000, 10400),
  ('a1b2c3d4-0001-4000-8000-000000000002',  6,  7500, 13900),
  ('a1b2c3d4-0001-4000-8000-000000000002', 12, 13500, 19900),
  ('a1b2c3d4-0001-4000-8000-000000000002', 24, 26000, 32400),
  ('a1b2c3d4-0001-4000-8000-000000000002', 36, 36000, 42400);

-- 5G Entry terms
INSERT INTO public.pricing_subscription_terms (product_id, months, service_price_cents, bundle_price_cents) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000003',  1,  1500,  7000),
  ('a1b2c3d4-0001-4000-8000-000000000003',  3,  4000,  9500),
  ('a1b2c3d4-0001-4000-8000-000000000003',  6,  7500, 13000),
  ('a1b2c3d4-0001-4000-8000-000000000003', 12, 13500, 19000),
  ('a1b2c3d4-0001-4000-8000-000000000003', 24, 26000, 31500),
  ('a1b2c3d4-0001-4000-8000-000000000003', 36, 36000, 41500);

-- 4G Hotspot terms
INSERT INTO public.pricing_subscription_terms (product_id, months, service_price_cents, bundle_price_cents) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000004',  1,  1500,  5500),
  ('a1b2c3d4-0001-4000-8000-000000000004',  3,  4000,  8000),
  ('a1b2c3d4-0001-4000-8000-000000000004',  6,  7500, 11500),
  ('a1b2c3d4-0001-4000-8000-000000000004', 12, 13500, 17500),
  ('a1b2c3d4-0001-4000-8000-000000000004', 24, 26000, 30000),
  ('a1b2c3d4-0001-4000-8000-000000000004', 36, 36000, 40000);
