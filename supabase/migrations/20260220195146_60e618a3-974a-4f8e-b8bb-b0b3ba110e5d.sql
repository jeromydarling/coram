
-- 1) Add source_note_id to metro_expansion_plans
ALTER TABLE public.metro_expansion_plans
  ADD COLUMN IF NOT EXISTS source_note_id uuid NULL;

-- 2) Create field_notes table for human intention space
CREATE TABLE public.field_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  metro_id uuid REFERENCES public.metros(id),
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_field_notes_tenant ON public.field_notes (tenant_id, created_at DESC);
CREATE INDEX idx_field_notes_user ON public.field_notes (user_id, created_at DESC);
CREATE INDEX idx_field_notes_metro ON public.field_notes (metro_id) WHERE metro_id IS NOT NULL;

-- RLS
ALTER TABLE public.field_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own field notes"
  ON public.field_notes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own field notes"
  ON public.field_notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own field notes"
  ON public.field_notes FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own field notes"
  ON public.field_notes FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER trg_field_notes_updated_at
  BEFORE UPDATE ON public.field_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
