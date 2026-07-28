
-- operator_playbooks: internal knowledge playbooks for operator workflows
CREATE TABLE public.operator_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'activation'
    CHECK (category IN ('activation','qa','migration','support','outreach','expansion')),
  content_md text NOT NULL DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on operator_playbooks"
  ON public.operator_playbooks
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- operator_expansion_watch: operator-level expansion tracking per tenant+metro
CREATE TABLE public.operator_expansion_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'considering'
    CHECK (phase IN ('considering','scouting','first_presence','early_relationships','community_entry')),
  risk_level text NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metro_id)
);

ALTER TABLE public.operator_expansion_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on operator_expansion_watch"
  ON public.operator_expansion_watch
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
