
-- prospect_packs table for storing AI-generated prospect briefings
CREATE TABLE public.prospect_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL DEFAULT 'opportunity' CHECK (entity_type IN ('opportunity', 'org')),
  entity_id uuid NOT NULL,
  run_id uuid NOT NULL UNIQUE,
  pack_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by entity
CREATE INDEX idx_prospect_packs_entity ON public.prospect_packs (entity_type, entity_id);
CREATE INDEX idx_prospect_packs_run_id ON public.prospect_packs (run_id);

-- Enable RLS
ALTER TABLE public.prospect_packs ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users with CRM roles can read
CREATE POLICY "Authenticated users can read prospect packs"
ON public.prospect_packs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'leadership', 'regional_lead', 'staff')
  )
);

-- RLS: Only service role inserts (via edge functions)
-- No INSERT/UPDATE/DELETE policies for regular users
-- Edge functions use service role key
