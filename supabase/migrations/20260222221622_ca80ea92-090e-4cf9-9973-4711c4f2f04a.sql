
-- ═══ NRI Design Suggestions ═══
CREATE TABLE public.nri_design_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  pattern_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'medium',
  suggestion_summary text NOT NULL,
  narrative_detail text NOT NULL,
  affected_routes text[] NOT NULL DEFAULT '{}',
  roles_affected text[] NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Validation trigger instead of CHECK
CREATE OR REPLACE FUNCTION public.validate_nri_design_suggestion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.severity NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid nri_design_suggestions severity: %', NEW.severity;
  END IF;
  IF NEW.status NOT IN ('open', 'reviewed', 'implemented', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid nri_design_suggestions status: %', NEW.status;
  END IF;
  IF length(NEW.suggestion_summary) > 220 THEN
    RAISE EXCEPTION 'suggestion_summary exceeds 220 chars';
  END IF;
  IF length(NEW.narrative_detail) > 2000 THEN
    RAISE EXCEPTION 'narrative_detail exceeds 2000 chars';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_nri_design_suggestion
  BEFORE INSERT OR UPDATE ON public.nri_design_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.validate_nri_design_suggestion();

-- RLS
ALTER TABLE public.nri_design_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can read all design suggestions"
  ON public.nri_design_suggestions FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Operators can update design suggestions"
  ON public.nri_design_suggestions FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Service role inserts design suggestions"
  ON public.nri_design_suggestions FOR INSERT
  WITH CHECK (true);

-- ═══ NRI Playbook Drafts ═══
CREATE TABLE public.nri_playbook_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  pattern_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  role text,
  related_feature_key text,
  draft_markdown text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_nri_playbook_draft()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid nri_playbook_drafts status: %', NEW.status;
  END IF;
  IF NEW.role IS NOT NULL AND NEW.role NOT IN ('visitor', 'companion', 'shepherd', 'steward') THEN
    RAISE EXCEPTION 'Invalid nri_playbook_drafts role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_nri_playbook_draft
  BEFORE INSERT OR UPDATE ON public.nri_playbook_drafts
  FOR EACH ROW EXECUTE FUNCTION public.validate_nri_playbook_draft();

-- RLS
ALTER TABLE public.nri_playbook_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can read all playbook drafts"
  ON public.nri_playbook_drafts FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Operators can update playbook drafts"
  ON public.nri_playbook_drafts FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Service role inserts playbook drafts"
  ON public.nri_playbook_drafts FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_nri_design_suggestions_status ON public.nri_design_suggestions(status);
CREATE INDEX idx_nri_design_suggestions_severity ON public.nri_design_suggestions(severity);
CREATE INDEX idx_nri_playbook_drafts_status ON public.nri_playbook_drafts(status);
