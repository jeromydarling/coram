
-- ====================================================================
-- PHASE 3C: Proactive Discovery + AI Briefings
-- ====================================================================

-- 1) discovery_runs
CREATE TABLE public.discovery_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module text NOT NULL CHECK (module IN ('grants','events','people')),
  scope text NOT NULL CHECK (scope IN ('metro','opportunity')),
  metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL,
  opportunity_id uuid NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  query_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_runs_module_created ON public.discovery_runs(module, created_at DESC);
CREATE INDEX idx_discovery_runs_metro_module ON public.discovery_runs(metro_id, module, created_at DESC);
CREATE INDEX idx_discovery_runs_opp_module ON public.discovery_runs(opportunity_id, module, created_at DESC);

ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/leadership read all discovery_runs"
  ON public.discovery_runs FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  );

CREATE POLICY "Users read discovery_runs for their metros"
  ON public.discovery_runs FOR SELECT
  USING (
    (metro_id IS NOT NULL AND public.has_metro_access(auth.uid(), metro_id))
    OR (opportunity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.opportunities o WHERE o.id = discovery_runs.opportunity_id AND public.has_metro_access(auth.uid(), o.metro_id)
    ))
  );

-- 2) discovered_items
CREATE TABLE public.discovered_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module text NOT NULL CHECK (module IN ('grants','events','people')),
  canonical_url text NOT NULL,
  source_url text NULL,
  title text NULL,
  snippet text NULL,
  published_date date NULL,
  event_date date NULL,
  organization_name text NULL,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprints jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_run_id uuid NULL REFERENCES public.discovery_runs(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(module, canonical_url)
);

CREATE INDEX idx_discovered_items_module_seen ON public.discovered_items(module, last_seen_at DESC);
CREATE INDEX idx_discovered_items_module_event ON public.discovered_items(module, event_date);
CREATE INDEX idx_discovered_items_extracted ON public.discovered_items USING gin(extracted);

ALTER TABLE public.discovered_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/leadership read all discovered_items"
  ON public.discovered_items FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  );

-- 3) discovery_item_links
CREATE TABLE public.discovery_item_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discovered_item_id uuid NOT NULL REFERENCES public.discovered_items(id) ON DELETE CASCADE,
  metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL,
  opportunity_id uuid NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  relevance_score int NOT NULL DEFAULT 0,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_discovery_item_links_unique ON public.discovery_item_links(
  discovered_item_id,
  COALESCE(metro_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE INDEX idx_discovery_item_links_metro ON public.discovery_item_links(metro_id, created_at DESC);
CREATE INDEX idx_discovery_item_links_opp ON public.discovery_item_links(opportunity_id, created_at DESC);

ALTER TABLE public.discovery_item_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read discovery_item_links for their metros"
  ON public.discovery_item_links FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR (metro_id IS NOT NULL AND public.has_metro_access(auth.uid(), metro_id))
    OR (opportunity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.opportunities o WHERE o.id = discovery_item_links.opportunity_id AND public.has_metro_access(auth.uid(), o.metro_id)
    ))
  );

-- Now add RLS policy for discovered_items via links (link table exists now)
CREATE POLICY "Users read discovered_items via links"
  ON public.discovered_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.discovery_item_links dil
      WHERE dil.discovered_item_id = discovered_items.id
      AND (
        (dil.metro_id IS NOT NULL AND public.has_metro_access(auth.uid(), dil.metro_id))
        OR (dil.opportunity_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.opportunities o WHERE o.id = dil.opportunity_id AND public.has_metro_access(auth.uid(), o.metro_id)
        ))
      )
    )
  );

-- 4) discovery_briefings
CREATE TABLE public.discovery_briefings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.discovery_runs(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('grants','events','people')),
  scope text NOT NULL CHECK (scope IN ('metro','opportunity')),
  metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL,
  opportunity_id uuid NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  briefing_md text NOT NULL,
  briefing_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_briefings_module ON public.discovery_briefings(module, created_at DESC);
CREATE INDEX idx_discovery_briefings_metro ON public.discovery_briefings(metro_id, module, created_at DESC);
CREATE INDEX idx_discovery_briefings_opp ON public.discovery_briefings(opportunity_id, module, created_at DESC);

ALTER TABLE public.discovery_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/leadership read all discovery_briefings"
  ON public.discovery_briefings FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  );

CREATE POLICY "Users read discovery_briefings for their metros"
  ON public.discovery_briefings FOR SELECT
  USING (
    (metro_id IS NOT NULL AND public.has_metro_access(auth.uid(), metro_id))
    OR (opportunity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.opportunities o WHERE o.id = discovery_briefings.opportunity_id AND public.has_metro_access(auth.uid(), o.metro_id)
    ))
  );

-- 5) discovery_highlights
CREATE TABLE public.discovery_highlights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.discovery_runs(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('grants','events','people')),
  kind text NOT NULL CHECK (kind IN ('urgent','new','changed','recommended_source')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_highlights_run ON public.discovery_highlights(run_id);

ALTER TABLE public.discovery_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/leadership read all discovery_highlights"
  ON public.discovery_highlights FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  );

CREATE POLICY "Users read discovery_highlights via run"
  ON public.discovery_highlights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.discovery_runs dr
      WHERE dr.id = discovery_highlights.run_id
      AND (
        (dr.metro_id IS NOT NULL AND public.has_metro_access(auth.uid(), dr.metro_id))
        OR (dr.opportunity_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.opportunities o WHERE o.id = dr.opportunity_id AND public.has_metro_access(auth.uid(), o.metro_id)
        ))
      )
    )
  );

-- Trigger for updated_at on discovery_runs
CREATE TRIGGER update_discovery_runs_updated_at
  BEFORE UPDATE ON public.discovery_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Expand proactive_notifications check constraint
ALTER TABLE public.proactive_notifications
  DROP CONSTRAINT IF EXISTS proactive_notifications_notification_type_check;

ALTER TABLE public.proactive_notifications
  ADD CONSTRAINT proactive_notifications_notification_type_check
  CHECK (notification_type IN ('momentum_spike', 'upcoming_event', 'leadership_change', 'threshold_crossing', 'discovery_event', 'discovery_grant', 'discovery_people'));
