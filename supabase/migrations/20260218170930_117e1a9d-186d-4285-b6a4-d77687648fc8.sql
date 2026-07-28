
-- ═══════════════════════════════════════════════════════════
-- Metro News Keywords Engine — Phase 5B
-- ═══════════════════════════════════════════════════════════

-- 1) Global News Keywords (admin-managed seed defaults)
CREATE TABLE public.global_news_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  category text NOT NULL,
  weight int NOT NULL DEFAULT 5 CHECK (weight >= 1 AND weight <= 10),
  enabled boolean NOT NULL DEFAULT true,
  match_mode text NOT NULL DEFAULT 'phrase' CHECK (match_mode IN ('phrase','any','all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_global_news_keywords_updated_at
  BEFORE UPDATE ON public.global_news_keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.global_news_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gnk_select" ON public.global_news_keywords
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "gnk_admin_insert" ON public.global_news_keywords
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "gnk_admin_update" ON public.global_news_keywords
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "gnk_admin_delete" ON public.global_news_keywords
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));


-- 2) Metro News Keywords (per-metro overrides)
CREATE TABLE public.metro_news_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  category text NOT NULL,
  weight int NOT NULL DEFAULT 5 CHECK (weight >= 1 AND weight <= 10),
  enabled boolean NOT NULL DEFAULT true,
  match_mode text NOT NULL DEFAULT 'phrase' CHECK (match_mode IN ('phrase','any','all')),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metro_id, keyword)
);

CREATE INDEX idx_metro_news_keywords_metro_enabled ON public.metro_news_keywords (metro_id, enabled);
CREATE INDEX idx_metro_news_keywords_metro_category ON public.metro_news_keywords (metro_id, category);

CREATE TRIGGER set_metro_news_keywords_updated_at
  BEFORE UPDATE ON public.metro_news_keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.metro_news_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mnk_select" ON public.metro_news_keywords
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "mnk_insert" ON public.metro_news_keywords
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "mnk_update" ON public.metro_news_keywords
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "mnk_delete" ON public.metro_news_keywords
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );


-- 3) Metro News Keyword Sets (per-metro settings)
CREATE TABLE public.metro_news_keyword_sets (
  metro_id uuid PRIMARY KEY REFERENCES public.metros(id) ON DELETE CASCADE,
  use_global_defaults boolean NOT NULL DEFAULT true,
  max_keywords int NOT NULL DEFAULT 40,
  radius_miles int NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_metro_news_keyword_sets_updated_at
  BEFORE UPDATE ON public.metro_news_keyword_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.metro_news_keyword_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mnks_select" ON public.metro_news_keyword_sets
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "mnks_insert" ON public.metro_news_keyword_sets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "mnks_update" ON public.metro_news_keyword_sets
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

CREATE POLICY "mnks_delete" ON public.metro_news_keyword_sets
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );


-- 4) Seed global_news_keywords

INSERT INTO public.global_news_keywords (keyword, category, weight) VALUES
  -- need_signals (weight 7-8)
  ('eviction', 'need_signals', 8),
  ('shelter opening', 'need_signals', 8),
  ('warming center', 'need_signals', 7),
  ('cooling center', 'need_signals', 7),
  ('rent assistance', 'need_signals', 8),
  ('housing voucher', 'need_signals', 7),
  ('displacement', 'need_signals', 7),
  ('emergency shelter', 'need_signals', 8),
  ('affordable housing waitlist', 'need_signals', 7),
  ('food pantry', 'need_signals', 6),
  ('utility assistance', 'need_signals', 6),
  ('homelessness', 'need_signals', 7),

  -- education (weight 6-7)
  ('digital divide', 'education', 7),
  ('remote learning', 'education', 6),
  ('students without devices', 'education', 7),
  ('homework gap', 'education', 7),
  ('library technology class', 'education', 6),
  ('school technology program', 'education', 6),
  ('education equity', 'education', 6),
  ('afterschool program', 'education', 5),

  -- workforce (weight 6-7)
  ('workforce development', 'workforce', 7),
  ('job training', 'workforce', 6),
  ('reentry program', 'workforce', 7),
  ('resume workshop', 'workforce', 5),
  ('digital literacy', 'workforce', 7),
  ('skills training', 'workforce', 6),
  ('apprenticeship program', 'workforce', 6),
  ('career readiness', 'workforce', 5),

  -- health_services (weight 5-6)
  ('community clinic', 'health_services', 6),
  ('telehealth access', 'health_services', 6),
  ('refugee services', 'health_services', 7),
  ('immigrant services', 'health_services', 7),
  ('senior services', 'health_services', 6),
  ('mental health services', 'health_services', 6),
  ('community health worker', 'health_services', 5),

  -- partner_signals (weight 6-7)
  ('nonprofit grant', 'partner_signals', 7),
  ('grant award', 'partner_signals', 7),
  ('foundation funding', 'partner_signals', 6),
  ('community coalition', 'partner_signals', 6),
  ('mutual aid', 'partner_signals', 6),
  ('community partnership', 'partner_signals', 6),
  ('capacity building', 'partner_signals', 5),
  ('community investment', 'partner_signals', 6),

  -- policy (weight 6-7)
  ('broadband expansion', 'policy', 7),
  ('digital equity funding', 'policy', 7),
  ('municipal broadband', 'policy', 6),
  ('city ordinance', 'policy', 5),
  ('digital inclusion plan', 'policy', 7),
  ('connectivity initiative', 'policy', 6),
  ('internet access program', 'policy', 6),

  -- local_events (weight 5-6)
  ('resource fair', 'local_events', 6),
  ('community meeting', 'local_events', 5),
  ('job fair', 'local_events', 6),
  ('library workshop', 'local_events', 5),
  ('back-to-school event', 'local_events', 6),
  ('community forum', 'local_events', 5),
  ('volunteer event', 'local_events', 5),
  ('neighborhood meeting', 'local_events', 5),

  -- tone (weight 3-4, lower weight)
  ('digital inclusion', 'tone', 4),
  ('underserved community', 'tone', 4),
  ('equity initiative', 'tone', 4),
  ('community resilience', 'tone', 3),
  ('bridging the gap', 'tone', 3),
  ('community empowerment', 'tone', 3);
