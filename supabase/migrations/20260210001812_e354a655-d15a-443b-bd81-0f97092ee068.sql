
-- Create contact_suggestions table
CREATE TABLE public.contact_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE,
  entity_type text NOT NULL CHECK (entity_type IN ('event', 'opportunity', 'grant')),
  entity_id uuid NOT NULL,
  source_url text NOT NULL,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'applied', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_contact_suggestions_entity ON public.contact_suggestions (entity_type, entity_id);
CREATE INDEX idx_contact_suggestions_status ON public.contact_suggestions (status, created_at);

-- Enable RLS
ALTER TABLE public.contact_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can SELECT if they can access the entity
-- We use a broad "authenticated" check here; entity-level access is enforced
-- via the edge functions that serve the data. The RLS prevents anon access.
CREATE POLICY "Authenticated users can read contact suggestions"
  ON public.contact_suggestions
  FOR SELECT
  TO authenticated
  USING (true);

-- No direct INSERT/UPDATE/DELETE from clients
-- All writes go through Edge Functions with service role

-- Updated_at trigger
CREATE TRIGGER set_contact_suggestions_updated_at
  BEFORE UPDATE ON public.contact_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
