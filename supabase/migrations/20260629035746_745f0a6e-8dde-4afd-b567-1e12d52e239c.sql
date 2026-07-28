
-- 1) campaign_suggestions: tenant-scoped SELECT
DROP POLICY IF EXISTS "Authenticated users can view suggestions" ON public.campaign_suggestions;
CREATE POLICY "campaign_suggestions_select_scoped"
  ON public.campaign_suggestions FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = campaign_suggestions.org_id
        AND public.is_tenant_member(o.tenant_id, auth.uid())
    )
  );

-- 2) campaign_suggestion_decisions: tenant-scoped SELECT
DROP POLICY IF EXISTS "campaign_suggestion_decisions_select" ON public.campaign_suggestion_decisions;
CREATE POLICY "campaign_suggestion_decisions_select_scoped"
  ON public.campaign_suggestion_decisions FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR EXISTS (
      SELECT 1
      FROM public.campaign_suggestions cs
      JOIN public.opportunities o ON o.id = cs.org_id
      WHERE cs.id = campaign_suggestion_decisions.suggestion_id
        AND public.is_tenant_member(o.tenant_id, auth.uid())
    )
  );

-- 3) opportunity_signals: tenant-scoped SELECT
DROP POLICY IF EXISTS "Authenticated users can read opportunity_signals" ON public.opportunity_signals;
CREATE POLICY "opportunity_signals_select_scoped"
  ON public.opportunity_signals FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_signals.opportunity_id
        AND public.is_tenant_member(o.tenant_id, auth.uid())
    )
  );

-- 4) opportunity_reflections: team visibility requires tenant membership
DROP POLICY IF EXISTS "Team reflections visible with metro access" ON public.opportunity_reflections;
CREATE POLICY "Team reflections visible to tenant members"
  ON public.opportunity_reflections FOR SELECT
  TO authenticated
  USING (
    visibility = 'team'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_reflections.opportunity_id
        AND public.is_tenant_member(o.tenant_id, auth.uid())
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- 5) volunteers: tenant-scoped role read
DROP POLICY IF EXISTS "volunteers_select" ON public.volunteers;
CREATE POLICY "volunteers_select_tenant_scoped"
  ON public.volunteers FOR SELECT
  TO authenticated
  USING (
    (deleted_at IS NULL)
    AND public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead','staff']::app_role[])
    AND public.is_tenant_member(tenant_id, auth.uid())
  );

-- 6) has_metro_access: remove "no assignments = sees everything" bypass
CREATE OR REPLACE FUNCTION public.has_metro_access(_user_id uuid, _metro_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_any_role(_user_id, ARRAY['admin', 'leadership']::app_role[])
    OR EXISTS (
      SELECT 1
      FROM public.user_region_assignments ura
      JOIN public.metros m ON m.region_id = ura.region_id
      WHERE ura.user_id = _user_id
        AND m.id = _metro_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_metro_assignments
      WHERE user_id = _user_id
        AND metro_id = _metro_id
    )
$function$;
