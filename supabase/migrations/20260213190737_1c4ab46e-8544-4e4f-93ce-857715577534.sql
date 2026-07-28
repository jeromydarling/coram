
-- BLOCKER #1: Rename organization_id → opportunity_id in relationship_momentum
-- Drop existing policies first
DROP POLICY IF EXISTS "Admin and leadership read all momentum" ON public.relationship_momentum;
DROP POLICY IF EXISTS "Users read momentum for accessible metros" ON public.relationship_momentum;

-- Rename column
ALTER TABLE public.relationship_momentum RENAME COLUMN organization_id TO opportunity_id;

-- Drop and re-create FK constraint
ALTER TABLE public.relationship_momentum DROP CONSTRAINT IF EXISTS relationship_momentum_organization_id_fkey;
ALTER TABLE public.relationship_momentum ADD CONSTRAINT relationship_momentum_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;

-- Re-create RLS policies with correct column name
CREATE POLICY "Admin and leadership read all momentum"
  ON public.relationship_momentum FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]));

CREATE POLICY "Users read momentum for accessible metros"
  ON public.relationship_momentum FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = relationship_momentum.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- Ensure no INSERT/UPDATE/DELETE by authenticated users (service role only)
-- RLS is already enabled, and we only have SELECT policies, so INSERT/UPDATE/DELETE are denied by default.
