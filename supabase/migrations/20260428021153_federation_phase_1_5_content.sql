-- ============================================================================
-- CROS Federation — Phase 1.5: Content Consolidation (Phase A)
-- ============================================================================
-- Adds the federation primitives required by the unified Scientia console:
--   1. source_app discriminator on content tables
--   2. Widened status enum: draft → pending_approval → approved → published
--      → unpublished, plus rejected and scheduled
--   3. Approval / publish bookkeeping columns on operator_content_drafts
--   4. essay_templates federation primitive (lifted from bitoku pattern,
--      shareable across apps via NULL source_app)
--   5. content_approval_log for status transitions (writes also flow through
--      federated_audit via the recordAudit helper)
--   6. RLS policies scoped by has_gardener_grant(source_app)
--
-- Phase A scope: thecros's own data only. Satellites onboarded in B-E.
-- ============================================================================

-- ---------------------------------------------------------------------
-- 1. operator_content_drafts — add federation columns
-- ---------------------------------------------------------------------

-- Drop the old narrow status check before adding the new statuses
ALTER TABLE public.operator_content_drafts
  DROP CONSTRAINT IF EXISTS operator_content_drafts_status_check;

ALTER TABLE public.operator_content_drafts
  ADD COLUMN IF NOT EXISTS source_app cros_app_slug NOT NULL DEFAULT 'thecros',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_url text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS generator text,
  ADD COLUMN IF NOT EXISTS template_id uuid;

-- Reapply the status constraint with the federated enum.
-- Legacy mapping:
--   'review'    -> 'pending_approval'
--   'archived'  -> 'unpublished'
--   'dismissed' -> 'rejected'  (closest semantic equivalent in the new enum)
UPDATE public.operator_content_drafts SET status = 'pending_approval' WHERE status = 'review';
UPDATE public.operator_content_drafts SET status = 'unpublished'      WHERE status = 'archived';
UPDATE public.operator_content_drafts SET status = 'rejected'         WHERE status = 'dismissed';

ALTER TABLE public.operator_content_drafts
  ADD CONSTRAINT operator_content_drafts_status_check
  CHECK (status IN ('draft','pending_approval','approved','scheduled','published','unpublished','rejected'));

CREATE INDEX IF NOT EXISTS idx_content_drafts_source_app
  ON public.operator_content_drafts (source_app);
CREATE INDEX IF NOT EXISTS idx_content_drafts_status
  ON public.operator_content_drafts (status);
CREATE INDEX IF NOT EXISTS idx_content_drafts_pending_approval
  ON public.operator_content_drafts (source_app, updated_at DESC)
  WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_content_drafts_scheduled
  ON public.operator_content_drafts (scheduled_for)
  WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

COMMENT ON COLUMN public.operator_content_drafts.source_app IS
  'Federated app slug. Defaults to thecros; satellites set on backfill in Phases B-E.';
COMMENT ON COLUMN public.operator_content_drafts.generator IS
  'Last edge function used to generate this draft (gardener-insight-generator, perplexity-generate-essay, seo-generate, etc.). For dispatch + audit.';

-- ---------------------------------------------------------------------
-- 2. operator_rss_sources / operator_rss_items — add source_app
-- ---------------------------------------------------------------------

ALTER TABLE public.operator_rss_sources
  ADD COLUMN IF NOT EXISTS source_app cros_app_slug NOT NULL DEFAULT 'thecros';

ALTER TABLE public.operator_rss_items
  ADD COLUMN IF NOT EXISTS source_app cros_app_slug NOT NULL DEFAULT 'thecros';

CREATE INDEX IF NOT EXISTS idx_rss_sources_source_app
  ON public.operator_rss_sources (source_app);
CREATE INDEX IF NOT EXISTS idx_rss_items_source_app
  ON public.operator_rss_items (source_app);

-- ---------------------------------------------------------------------
-- 3. essay_templates — federation primitive (NULL source_app = global)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.essay_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app cros_app_slug NULL,                  -- NULL = available to all apps
  name text NOT NULL,
  prompt text NOT NULL,
  voice_notes text,
  category text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_essay_templates_source_app
  ON public.essay_templates (source_app) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_essay_templates_category
  ON public.essay_templates (category) WHERE enabled = true;

ALTER TABLE public.operator_content_drafts
  ADD CONSTRAINT operator_content_drafts_template_fk
  FOREIGN KEY (template_id) REFERENCES public.essay_templates(id) ON DELETE SET NULL;

ALTER TABLE public.essay_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "essay_templates_read"
  ON public.essay_templates
  FOR SELECT
  TO authenticated
  USING (
    source_app IS NULL
    OR public.has_gardener_grant(source_app)
  );

CREATE POLICY "essay_templates_write"
  ON public.essay_templates
  FOR ALL
  TO authenticated
  USING (
    source_app IS NULL AND public.has_gardener_grant('*')
    OR source_app IS NOT NULL AND public.has_gardener_grant(source_app)
  )
  WITH CHECK (
    source_app IS NULL AND public.has_gardener_grant('*')
    OR source_app IS NOT NULL AND public.has_gardener_grant(source_app)
  );

COMMENT ON TABLE public.essay_templates IS
  'Reusable prompt scaffolds for AI essay generation. NULL source_app means the template is available to every federated app. Lifted from bitokus content_essay_templates.';

-- ---------------------------------------------------------------------
-- 4. content_approval_log — status transition audit
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_approval_log (
  id bigserial PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES public.operator_content_drafts(id) ON DELETE CASCADE,
  source_app cros_app_slug NOT NULL,
  actor uuid REFERENCES auth.users(id),
  from_status text,
  to_status text NOT NULL,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_log_draft
  ON public.content_approval_log (draft_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_log_source_app
  ON public.content_approval_log (source_app, occurred_at DESC);

ALTER TABLE public.content_approval_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_log_read"
  ON public.content_approval_log
  FOR SELECT
  TO authenticated
  USING (public.has_gardener_grant(source_app));

CREATE POLICY "approval_log_write"
  ON public.content_approval_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_gardener_grant(source_app)
    AND (actor IS NULL OR actor = auth.uid())
  );

COMMENT ON TABLE public.content_approval_log IS
  'Per-draft audit trail of status transitions. Mirrored to federated_audit by the recordAudit helper for cross-app visibility.';

-- ---------------------------------------------------------------------
-- 5. Federated RLS on operator_content_drafts (replaces admin-only policy)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "admin_manage_content_drafts" ON public.operator_content_drafts;

CREATE POLICY "content_drafts_app_scope"
  ON public.operator_content_drafts
  FOR ALL
  TO authenticated
  USING (public.has_gardener_grant(source_app))
  WITH CHECK (public.has_gardener_grant(source_app));

-- Keep a fallback admin policy so legacy admin sessions retain access during cutover
CREATE POLICY "content_drafts_admin_fallback"
  ON public.operator_content_drafts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 6. Federated RLS on operator_rss_sources / operator_rss_items
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "admin_manage_rss_sources" ON public.operator_rss_sources;
DROP POLICY IF EXISTS "admin_manage_rss_items"   ON public.operator_rss_items;

CREATE POLICY "rss_sources_app_scope"
  ON public.operator_rss_sources
  FOR ALL
  TO authenticated
  USING (public.has_gardener_grant(source_app) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_gardener_grant(source_app) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rss_items_app_scope"
  ON public.operator_rss_items
  FOR ALL
  TO authenticated
  USING (public.has_gardener_grant(source_app) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_gardener_grant(source_app) OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 7. updated_at trigger for essay_templates
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_essay_templates_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS essay_templates_touch_updated_at ON public.essay_templates;
CREATE TRIGGER essay_templates_touch_updated_at
  BEFORE UPDATE ON public.essay_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_essay_templates_updated_at();
