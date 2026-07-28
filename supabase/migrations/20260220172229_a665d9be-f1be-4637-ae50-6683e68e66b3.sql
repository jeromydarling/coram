
-- Phase 8: Ecosystem Intelligence Spine

-- PART 1: Ecosystem graph tables
CREATE TABLE public.ecosystem_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  metro_id uuid REFERENCES public.metros(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN ('tenant','metro')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ecosystem_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin-only read ecosystem_nodes"
  ON public.ecosystem_nodes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ecosystem_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node uuid NOT NULL REFERENCES public.ecosystem_nodes(id) ON DELETE CASCADE,
  to_node uuid NOT NULL REFERENCES public.ecosystem_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL CHECK (edge_type IN ('communio','shared_metro','expansion_interest')),
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ecosystem_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin-only read ecosystem_edges"
  ON public.ecosystem_edges FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PART 2: Metro status extension
ALTER TABLE public.metros
  ADD COLUMN IF NOT EXISTS ecosystem_status text NOT NULL DEFAULT 'active'
    CHECK (ecosystem_status IN ('active','emerging','expansion_pipeline','dormant')),
  ADD COLUMN IF NOT EXISTS expansion_priority int NOT NULL DEFAULT 0;

-- PART 3: Operator metro metrics
CREATE TABLE public.operator_metro_metrics (
  metro_id uuid PRIMARY KEY REFERENCES public.metros(id) ON DELETE CASCADE,
  tenant_count int NOT NULL DEFAULT 0,
  expansion_interest_count int NOT NULL DEFAULT 0,
  growth_velocity numeric NOT NULL DEFAULT 0,
  communio_overlap_score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_metro_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin-only read operator_metro_metrics"
  ON public.operator_metro_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for ecosystem queries
CREATE INDEX idx_ecosystem_nodes_type ON public.ecosystem_nodes(node_type);
CREATE INDEX idx_ecosystem_edges_type ON public.ecosystem_edges(edge_type);
CREATE INDEX idx_metros_ecosystem_status ON public.metros(ecosystem_status);
