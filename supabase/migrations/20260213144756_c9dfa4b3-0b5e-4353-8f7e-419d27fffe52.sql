
-- Relationship Edges table
CREATE TABLE public.relationship_edges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  edge_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_edge UNIQUE (source_type, source_id, target_type, target_id)
);

ALTER TABLE public.relationship_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read edges" ON public.relationship_edges
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert edges" ON public.relationship_edges
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_edges_source ON public.relationship_edges(source_type, source_id);
CREATE INDEX idx_edges_target ON public.relationship_edges(target_type, target_id);

-- Intelligence Feed Items table
CREATE TABLE public.intelligence_feed_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  signal_id uuid REFERENCES public.opportunity_signals(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  priority_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intelligence_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feed items" ON public.intelligence_feed_items
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can insert feed items" ON public.intelligence_feed_items
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_feed_user_priority ON public.intelligence_feed_items(user_id, priority_score DESC);

-- Add priority_score to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS priority_score numeric DEFAULT 0;
