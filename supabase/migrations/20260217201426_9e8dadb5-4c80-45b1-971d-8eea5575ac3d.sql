
-- Add total tracking columns to opportunity_orders
ALTER TABLE public.opportunity_orders
  ADD COLUMN total_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN total_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN notes text;

-- Backfill existing rows: set total_quantity from order_count
UPDATE public.opportunity_orders SET total_quantity = order_count WHERE total_quantity = 0;

-- Create order items table linking to provision catalog
CREATE TABLE public.opportunity_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.opportunity_orders(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.provision_catalog_items(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunity_order_items ENABLE ROW LEVEL SECURITY;

-- RLS: access follows the parent order's opportunity access
CREATE POLICY "Users can view order items if they can access the order's opportunity"
  ON public.opportunity_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunity_orders oo
      WHERE oo.id = order_id
        AND public.can_access_opportunity_order(auth.uid(), oo.opportunity_id)
    )
  );

CREATE POLICY "Users can insert order items if they can access the order's opportunity"
  ON public.opportunity_order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.opportunity_orders oo
      WHERE oo.id = order_id
        AND public.can_access_opportunity_order(auth.uid(), oo.opportunity_id)
    )
  );

CREATE POLICY "Admins and leadership can delete order items"
  ON public.opportunity_order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunity_orders oo
      WHERE oo.id = order_id
        AND public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
    )
  );

-- Index for fast lookups
CREATE INDEX idx_opportunity_order_items_order_id ON public.opportunity_order_items(order_id);
CREATE INDEX idx_opportunity_order_items_catalog_item_id ON public.opportunity_order_items(catalog_item_id);
