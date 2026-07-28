-- 1) Create the opportunity_orders table
CREATE TABLE public.opportunity_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  order_date date NOT NULL DEFAULT current_date,
  order_count int NOT NULL CHECK (order_count > 0),
  entered_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_opportunity_orders_opp_date ON public.opportunity_orders(opportunity_id, order_date DESC);

-- Enable RLS
ALTER TABLE public.opportunity_orders ENABLE ROW LEVEL SECURITY;

-- 2) Helper function to check opportunity order access
CREATE OR REPLACE FUNCTION public.can_access_opportunity_order(_user_id uuid, _opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin and Leadership have full access
    public.has_any_role(_user_id, ARRAY['admin', 'leadership']::app_role[])
    OR
    -- Other users need metro access to the opportunity's metro
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = _opportunity_id
        AND public.has_metro_access(_user_id, o.metro_id)
    )
$$;

-- 3) RLS Policies

-- SELECT: Admin/Leadership see all, others see via metro access
CREATE POLICY "Users can view orders for accessible opportunities"
ON public.opportunity_orders
FOR SELECT
TO authenticated
USING (public.can_access_opportunity_order(auth.uid(), opportunity_id));

-- INSERT: Must have access to opportunity AND be the one entering
CREATE POLICY "Users can insert orders for accessible opportunities"
ON public.opportunity_orders
FOR INSERT
TO authenticated
WITH CHECK (
  entered_by = auth.uid() 
  AND public.can_access_opportunity_order(auth.uid(), opportunity_id)
);

-- UPDATE: Only entered_by OR admin/leadership
CREATE POLICY "Users can update their own orders or admins can update any"
ON public.opportunity_orders
FOR UPDATE
TO authenticated
USING (
  entered_by = auth.uid() 
  OR public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
)
WITH CHECK (
  entered_by = auth.uid() 
  OR public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
);

-- DELETE: Admin/Leadership only
CREATE POLICY "Only admins and leadership can delete orders"
ON public.opportunity_orders
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- 4) Computed signals view for pipeline/scoring
CREATE OR REPLACE VIEW public.opportunity_order_signals AS
SELECT 
  o.id AS opportunity_id,
  MAX(oo.order_date) AS last_order_date,
  COALESCE(SUM(CASE WHEN oo.order_date >= current_date - 30 THEN oo.order_count ELSE 0 END), 0)::int AS orders_last_30,
  COALESCE(SUM(CASE WHEN oo.order_date >= current_date - 90 THEN oo.order_count ELSE 0 END), 0)::int AS orders_last_90
FROM public.opportunities o
LEFT JOIN public.opportunity_orders oo ON oo.opportunity_id = o.id
GROUP BY o.id;