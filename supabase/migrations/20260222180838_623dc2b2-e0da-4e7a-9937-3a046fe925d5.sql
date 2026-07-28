
-- ================================================
-- PHASE 21C: Simulation Engine + RSS Aggregator + Essays
-- ================================================

-- ─── PART 1: Simulation Engine ───

CREATE TABLE public.operator_simulation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  intensity text NOT NULL DEFAULT 'low' CHECK (intensity IN ('low','medium','active')),
  allowed_tenant_ids uuid[] NOT NULL DEFAULT '{}',
  allow_demo_only boolean NOT NULL DEFAULT true,
  simulate_visits boolean NOT NULL DEFAULT true,
  simulate_voice_notes boolean NOT NULL DEFAULT true,
  simulate_reflections boolean NOT NULL DEFAULT true,
  simulate_events boolean NOT NULL DEFAULT true,
  simulate_outreach boolean NOT NULL DEFAULT false,
  simulate_voluntarium boolean NOT NULL DEFAULT true,
  simulate_provisio boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.operator_simulation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_simulation_settings" ON public.operator_simulation_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- simulation_markers for cross-table tagging
CREATE TABLE public.simulation_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  record_table text NOT NULL,
  record_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('visit','voice_note','reflection','event','volunteer','other')),
  run_id uuid NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, record_table, record_id)
);

CREATE INDEX idx_simulation_markers_tenant ON public.simulation_markers(tenant_id, record_table, record_id);

ALTER TABLE public.simulation_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_simulation_markers" ON public.simulation_markers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper function
CREATE OR REPLACE FUNCTION public.is_simulated_record(p_tenant_id uuid, p_table text, p_record_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.simulation_markers
    WHERE tenant_id = p_tenant_id AND record_table = p_table AND record_id = p_record_id
  );
$$;

-- ─── PART 2: RSS Aggregator ───

CREATE TABLE public.operator_rss_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'nonprofit_news',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.operator_rss_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_rss_sources" ON public.operator_rss_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.operator_rss_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.operator_rss_sources(id) ON DELETE CASCADE,
  guid text NOT NULL,
  title text NOT NULL,
  link text NOT NULL,
  published_at timestamptz NULL,
  author text NULL,
  summary text NULL,
  content text NULL,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE(source_id, guid)
);

ALTER TABLE public.operator_rss_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_rss_items" ON public.operator_rss_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── PART 3: Essay Drafts (operator_content_drafts) ───

CREATE TABLE public.operator_content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_type text NOT NULL CHECK (draft_type IN ('essay','briefing','reflection','library_entry')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')),
  title text NOT NULL,
  body text NOT NULL,
  slug text NULL UNIQUE,
  slug_locked boolean NOT NULL DEFAULT false,
  source_item_ids uuid[] NOT NULL DEFAULT '{}',
  voice_profile text NOT NULL DEFAULT 'cros_nri',
  voice_origin text NOT NULL DEFAULT 'nri' CHECK (voice_origin IN ('nri','operator','tenant')),
  narrative_source text NOT NULL DEFAULT 'manual' CHECK (narrative_source IN ('rss','tenant_activity','manual')),
  is_interim_content boolean NOT NULL DEFAULT false,
  disclaimer text NOT NULL DEFAULT 'NRI-generated draft — Operator discernment required',
  seo_title text NULL,
  seo_description text NULL,
  og_image text NULL,
  collection text NULL,
  published_at timestamptz NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.operator_content_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_content_drafts" ON public.operator_content_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public read for published essays
CREATE POLICY "public_read_published_essays" ON public.operator_content_drafts
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE TABLE public.operator_content_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT true,
  allow_publish_to_public_site boolean DEFAULT false,
  publish_target text DEFAULT 'none' CHECK (publish_target IN ('none','essays','updates')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.operator_content_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_content_settings" ON public.operator_content_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
