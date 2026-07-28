
-- Allow hotspot items in opportunity_order_items without a catalog reference
ALTER TABLE public.opportunity_order_items
  ALTER COLUMN catalog_item_id DROP NOT NULL;

-- Add product_name for display when no catalog item is linked (hotspot items)
ALTER TABLE public.opportunity_order_items
  ADD COLUMN product_name text NULL;
