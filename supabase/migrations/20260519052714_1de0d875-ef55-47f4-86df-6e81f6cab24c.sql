
-- ============================================================
-- Tighten broad SELECT policies on org intelligence tables
-- and the documents storage bucket.
-- ============================================================

-- Helper expression used throughout: admin/leadership escape hatch
-- OR metro-scoped via opportunities.metro_id.

-- ---------- documents storage bucket ----------
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

CREATE POLICY "Users view own documents or admins any"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- ---------- org_snapshots ----------
DROP POLICY IF EXISTS "Authenticated users can read snapshots" ON public.org_snapshots;
CREATE POLICY "Metro-scoped read snapshots"
  ON public.org_snapshots FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_snapshots.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_snapshot_facts ----------
DROP POLICY IF EXISTS "Authenticated users can read snapshot facts" ON public.org_snapshot_facts;
CREATE POLICY "Metro-scoped read snapshot facts"
  ON public.org_snapshot_facts FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_snapshot_facts.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_snapshot_diffs ----------
DROP POLICY IF EXISTS "Authenticated users can read snapshot diffs" ON public.org_snapshot_diffs;
CREATE POLICY "Metro-scoped read snapshot diffs"
  ON public.org_snapshot_diffs FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_snapshot_diffs.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_watchlist ----------
DROP POLICY IF EXISTS "Authenticated users can read watchlist" ON public.org_watchlist;
CREATE POLICY "Metro-scoped read watchlist"
  ON public.org_watchlist FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_watchlist.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_watchlist_signals ----------
DROP POLICY IF EXISTS "Authenticated users can read watchlist signals" ON public.org_watchlist_signals;
CREATE POLICY "Metro-scoped read watchlist signals"
  ON public.org_watchlist_signals FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_watchlist_signals.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_enrichment_facts ----------
DROP POLICY IF EXISTS "Authenticated users can read org_enrichment_facts" ON public.org_enrichment_facts;
CREATE POLICY "Metro-scoped read org_enrichment_facts"
  ON public.org_enrichment_facts FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.org_extractions ex
      JOIN public.opportunities o
        ON lower(o.organization) = lower(ex.org_name)
      WHERE ex.id = org_enrichment_facts.extraction_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_extractions (no clean org_id link, restrict to admins) ----------
DROP POLICY IF EXISTS "Authenticated users can read org_extractions" ON public.org_extractions;
CREATE POLICY "Admins read org_extractions"
  ON public.org_extractions FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
  );

-- ---------- org_insight_generation_locks (system table, admin only) ----------
DROP POLICY IF EXISTS "Authenticated users can read insight gen locks" ON public.org_insight_generation_locks;
CREATE POLICY "Admins read insight gen locks"
  ON public.org_insight_generation_locks FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
  );

-- ---------- org_neighborhood_insights ----------
DROP POLICY IF EXISTS "Authenticated users can read neighborhood insights" ON public.org_neighborhood_insights;
CREATE POLICY "Metro-scoped read neighborhood insights"
  ON public.org_neighborhood_insights FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_neighborhood_insights.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_neighborhood_insight_sources ----------
DROP POLICY IF EXISTS "Authenticated users can read insight sources" ON public.org_neighborhood_insight_sources;
CREATE POLICY "Metro-scoped read insight sources"
  ON public.org_neighborhood_insight_sources FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1
      FROM public.org_neighborhood_insights ni
      JOIN public.opportunities o ON o.id = ni.org_id
      WHERE ni.id = org_neighborhood_insight_sources.insight_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_knowledge_sources ----------
DROP POLICY IF EXISTS "Authenticated users can read org knowledge sources" ON public.org_knowledge_sources;
CREATE POLICY "Metro-scoped read org knowledge sources"
  ON public.org_knowledge_sources FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1
      FROM public.org_knowledge_snapshots ks
      JOIN public.opportunities o ON o.id = ks.org_id
      WHERE ks.id = org_knowledge_sources.snapshot_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- org_next_actions ----------
DROP POLICY IF EXISTS "Authenticated users can read next actions" ON public.org_next_actions;
CREATE POLICY "Metro-scoped read next actions"
  ON public.org_next_actions FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = org_next_actions.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- Tighten the overly permissive UPDATE policy on org_next_actions
DROP POLICY IF EXISTS "Users can update their own actions" ON public.org_next_actions;
CREATE POLICY "Users update their own next actions"
  ON public.org_next_actions FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
  );

-- ---------- grant_alignment ----------
DROP POLICY IF EXISTS "Authenticated users can view grant alignments" ON public.grant_alignment;
CREATE POLICY "Metro-scoped read grant alignment"
  ON public.grant_alignment FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = grant_alignment.org_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- ---------- ai_recommendations ----------
DROP POLICY IF EXISTS "Authenticated users can read ai_recommendations" ON public.ai_recommendations;
CREATE POLICY "Metro-scoped read ai_recommendations"
  ON public.ai_recommendations FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- ---------- relationship_edges (no clean scope, restrict to admins) ----------
DROP POLICY IF EXISTS "Authenticated users can read edges" ON public.relationship_edges;
CREATE POLICY "Admins read relationship edges"
  ON public.relationship_edges FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
  );

-- ---------- communio_awareness_signals ----------
DROP POLICY IF EXISTS "Tenants can view awareness signals" ON public.communio_awareness_signals;
CREATE POLICY "Metro-scoped tenant awareness signals"
  ON public.communio_awareness_signals FOR SELECT
  USING (
    visibility = ANY (ARRAY['tenant'::text, 'both'::text])
    AND (
      metro_scope IS NULL
      OR public.has_metro_access(auth.uid(), metro_scope)
      OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leadership'::public.app_role])
    )
  );
