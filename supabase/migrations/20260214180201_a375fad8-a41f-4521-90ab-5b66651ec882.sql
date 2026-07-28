
-- =============================================
-- PROVISIONS SYSTEM — Phase 1 Migration
-- =============================================

-- 1) provision_catalog_items
CREATE TABLE public.provision_catalog_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  tier text,
  name text NOT NULL,
  description text,
  unit_price_cents integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provision_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view catalog"
  ON public.provision_catalog_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage catalog"
  ON public.provision_catalog_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) provisions
CREATE TABLE public.provisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  metro_id uuid REFERENCES public.metros(id),
  requested_by uuid NOT NULL,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'native',
  external_order_ref text,
  notes text,
  total_cents integer NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL DEFAULT 0,
  tracking_carrier text,
  tracking_number text,
  delivery_status text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  ordered_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provisions ENABLE ROW LEVEL SECURITY;

-- Provisions SELECT: admin/leadership see all, others need metro access OR be requester/assignee
CREATE POLICY "provisions_select"
  ON public.provisions FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR requested_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- Provisions INSERT: must have metro access (denormalized metro_id set by edge function)
CREATE POLICY "provisions_insert"
  ON public.provisions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'warehouse_manager')
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
      OR public.has_metro_access(auth.uid(), metro_id)
    )
  );

-- Provisions UPDATE: admin/staff for fulfillment, requester for draft edits
CREATE POLICY "provisions_update"
  ON public.provisions FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role])
    OR (requested_by = auth.uid() AND status = 'draft')
  );

-- Indexes
CREATE INDEX idx_provisions_opportunity ON public.provisions(opportunity_id, created_at DESC);
CREATE INDEX idx_provisions_metro ON public.provisions(metro_id, created_at DESC);
CREATE INDEX idx_provisions_assigned ON public.provisions(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_provisions_requested ON public.provisions(requested_by);

-- 3) provision_items
CREATE TABLE public.provision_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provision_id uuid NOT NULL REFERENCES public.provisions(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.provision_catalog_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  tier text,
  unit_price_cents integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  line_total_cents integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provision_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provision_items_select"
  ON public.provision_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.provisions p WHERE p.id = provision_items.provision_id
      AND (
        public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
        OR p.requested_by = auth.uid()
        OR p.assigned_to = auth.uid()
        OR public.has_metro_access(auth.uid(), p.metro_id)
      )
    )
  );

CREATE POLICY "provision_items_insert"
  ON public.provision_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.provisions p WHERE p.id = provision_items.provision_id
      AND (
        public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role])
        OR (p.requested_by = auth.uid() AND p.status = 'draft')
      )
    )
  );

CREATE POLICY "provision_items_update"
  ON public.provision_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.provisions p WHERE p.id = provision_items.provision_id
      AND (
        public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role])
        OR (p.requested_by = auth.uid() AND p.status = 'draft')
      )
    )
  );

CREATE POLICY "provision_items_delete"
  ON public.provision_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.provisions p WHERE p.id = provision_items.provision_id
      AND (
        public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role])
        OR (p.requested_by = auth.uid() AND p.status = 'draft')
      )
    )
  );

CREATE INDEX idx_provision_items_provision ON public.provision_items(provision_id);

-- 4) provision_messages
CREATE TABLE public.provision_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provision_id uuid NOT NULL REFERENCES public.provisions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provision_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provision_messages_select"
  ON public.provision_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.provisions p WHERE p.id = provision_messages.provision_id
      AND (
        public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
        OR p.requested_by = auth.uid()
        OR p.assigned_to = auth.uid()
        OR public.has_metro_access(auth.uid(), p.metro_id)
      )
    )
  );

CREATE POLICY "provision_messages_insert"
  ON public.provision_messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.provisions p WHERE p.id = provision_messages.provision_id
      AND (
        public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'staff'::app_role])
        OR p.requested_by = auth.uid()
        OR p.assigned_to = auth.uid()
        OR public.has_metro_access(auth.uid(), p.metro_id)
      )
    )
  );

CREATE INDEX idx_provision_messages_provision ON public.provision_messages(provision_id, created_at);

-- 5) provision_imports
CREATE TABLE public.provision_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provision_id uuid REFERENCES public.provisions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  raw_text text NOT NULL,
  parsed_json jsonb,
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provision_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provision_imports_select"
  ON public.provision_imports FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "provision_imports_insert"
  ON public.provision_imports FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND auth.uid() IS NOT NULL
  );

-- 6) Extend notification constraint
ALTER TABLE public.proactive_notifications
  DROP CONSTRAINT IF EXISTS proactive_notifications_notification_type_check;

ALTER TABLE public.proactive_notifications
  ADD CONSTRAINT proactive_notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'momentum_spike'::text,
    'upcoming_event'::text,
    'leadership_change'::text,
    'threshold_crossing'::text,
    'relationship_action_high_priority'::text,
    'relationship_story_update'::text,
    'discovery_event'::text,
    'discovery_grant'::text,
    'discovery_people'::text,
    'metro_narrative_update'::text,
    'provision_assigned'::text,
    'provision_message'::text,
    'provision_tracking_added'::text,
    'provision_delivery_update'::text,
    'provision_status_changed'::text
  ]));

-- 7) Seed 24 catalog items
INSERT INTO public.provision_catalog_items (category, tier, name, description, unit_price_cents) VALUES
  -- Desktops
  ('Desktop', 'Good', 'Desktop Good (Unit Only)', 'i5 (2nd-4th gen), 8GB RAM, 250GB SSD', 8500),
  ('Desktop', 'Good', 'Desktop Good (Full Set w/ Monitor, Keyboard, Mouse)', 'i5 (2nd-4th gen), 8GB RAM, 250GB SSD + Monitor, Keyboard, Mouse', 10000),
  ('Desktop', 'Better', 'Desktop Better (Unit Only)', 'i5 (4th-6th gen), 16GB RAM, 250GB SSD', 10000),
  ('Desktop', 'Better', 'Desktop Better (Full Set w/ Monitor, Keyboard, Mouse)', 'i5 (4th-6th gen), 16GB RAM, 250GB SSD + Monitor, Keyboard, Mouse', 12500),
  ('Desktop', 'Best', 'Desktop Best (Unit Only)', 'i5 (6th-8th gen), 16GB RAM, 500GB SSD', 11000),
  ('Desktop', 'Best', 'Desktop Best (Full Set w/ Monitor, Keyboard, Mouse)', 'i5 (6th-8th gen), 16GB RAM, 500GB SSD + Monitor, Keyboard, Mouse', 15000),
  -- Laptops
  ('Laptop', 'Good', 'Laptop Good', '120GB+ SSD, 8GB RAM, 8th-10th gen i3/i5', 10000),
  ('Laptop', 'Better', 'Laptop Better', '250GB SSD, 8GB+ RAM, 8th-9th gen i7 / 10th gen i5', 12500),
  ('Laptop', 'Best', 'Laptop Best', '250GB+ SSD, 16GB+ RAM, 10th gen i7+', 17500),
  -- Add-ons
  ('Add-on', NULL, 'SSD 250GB', 'Solid State Drive 250GB upgrade', 1500),
  ('Add-on', NULL, 'SSD 500GB', 'Solid State Drive 500GB upgrade', 3500),
  ('Add-on', NULL, 'SSD 1TB', 'Solid State Drive 1TB upgrade', 5500),
  ('Add-on', NULL, 'RAM 16GB', 'Memory upgrade to 16GB', 1500),
  ('Add-on', NULL, 'RAM 24GB', 'Memory upgrade to 24GB', 2500),
  ('Add-on', NULL, 'RAM 32GB', 'Memory upgrade to 32GB', 3500),
  ('Add-on', NULL, 'LCD Monitor 22"', '22-inch LCD Monitor', 5500),
  -- Accessories
  ('Accessory', NULL, 'Headset', 'Audio headset', 1200),
  ('Accessory', NULL, 'Wired Mouse (New)', 'New wired mouse', 500),
  ('Accessory', NULL, 'Flash Drive 64GB', '64GB USB flash drive', 1500),
  ('Accessory', NULL, 'Wireless Mouse', 'Wireless mouse', 1500),
  ('Accessory', NULL, 'Webcam', 'USB webcam', 1000),
  ('Accessory', NULL, 'Laptop Bag (Used)', 'Used laptop carry bag', 500),
  ('Accessory', NULL, 'Wired Keyboard', 'Wired USB keyboard', 1000),
  ('Accessory', NULL, 'Wireless Internet Adapter', 'USB wireless internet adapter', 1500);

-- 8) Updated_at trigger for provisions
CREATE TRIGGER update_provisions_updated_at
  BEFORE UPDATE ON public.provisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provision_catalog_updated_at
  BEFORE UPDATE ON public.provision_catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
