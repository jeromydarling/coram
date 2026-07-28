
-- Formation Prompts table
CREATE TABLE public.formation_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NULL,
  role text NOT NULL CHECK (role IN ('steward','shepherd','companion','visitor')),
  prompt_type text NOT NULL CHECK (prompt_type IN ('encouragement','reflection','next_step','gentle_checkin')),
  source text NOT NULL CHECK (source IN ('testimonium','friction','narrative_engine')),
  content text NOT NULL,
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NULL
);

ALTER TABLE public.formation_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read own formation prompts"
  ON public.formation_prompts FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    AND (formation_prompts.user_id IS NULL OR formation_prompts.user_id = auth.uid())
  );

CREATE POLICY "Service role can manage formation prompts"
  ON public.formation_prompts FOR ALL
  USING (auth.role() = 'service_role');

-- Narrative Moments table
CREATE TABLE public.narrative_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  metro_id uuid NULL REFERENCES public.metros(id),
  opportunity_id uuid NULL REFERENCES public.opportunities(id),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  moment_type text NOT NULL,
  excerpt text NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_table, source_id)
);

ALTER TABLE public.narrative_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read own narrative moments"
  ON public.narrative_moments FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage narrative moments"
  ON public.narrative_moments FOR ALL
  USING (auth.role() = 'service_role');

-- Narrative Threads table
CREATE TABLE public.narrative_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  week_start date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('tenant','metro','partner')),
  metro_id uuid NULL REFERENCES public.metros(id),
  opportunity_id uuid NULL REFERENCES public.opportunities(id),
  title text NOT NULL,
  summary text NOT NULL,
  signals jsonb DEFAULT '[]',
  open_loops jsonb DEFAULT '[]',
  created_by text DEFAULT 'engine',
  status text NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'published',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.narrative_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read own narrative threads"
  ON public.narrative_threads FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage narrative threads"
  ON public.narrative_threads FOR ALL
  USING (auth.role() = 'service_role');

-- Narrative Thread Moments (citations)
CREATE TABLE public.narrative_thread_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.narrative_threads(id) ON DELETE CASCADE,
  moment_id uuid NOT NULL REFERENCES public.narrative_moments(id),
  rank int NOT NULL,
  used_excerpt text NOT NULL
);

ALTER TABLE public.narrative_thread_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read thread moments via thread"
  ON public.narrative_thread_moments FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM public.narrative_threads
      WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Service role can manage thread moments"
  ON public.narrative_thread_moments FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_formation_prompts_tenant ON public.formation_prompts(tenant_id);
CREATE INDEX idx_formation_prompts_user ON public.formation_prompts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_narrative_moments_tenant ON public.narrative_moments(tenant_id);
CREATE INDEX idx_narrative_threads_tenant_week ON public.narrative_threads(tenant_id, week_start);
