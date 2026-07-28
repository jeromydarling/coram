
-- ═══════════════════════════════════════════════════════════════
-- Phase 4B v2: Journaling + Metro Narrative Blocks
-- ═══════════════════════════════════════════════════════════════

-- 1) Extend metro_narratives with period + authorship columns
ALTER TABLE public.metro_narratives
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Trigger for updated_at
CREATE TRIGGER update_metro_narratives_updated_at
  BEFORE UPDATE ON public.metro_narratives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) metro_narrative_blocks — stable paragraph anchors for scribble-anywhere
CREATE TABLE public.metro_narrative_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_id uuid NOT NULL REFERENCES public.metro_narratives(id) ON DELETE CASCADE,
  block_key text NOT NULL,
  block_text text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_narrative_blocks_narrative ON public.metro_narrative_blocks(narrative_id, order_index);
CREATE UNIQUE INDEX idx_narrative_blocks_key ON public.metro_narrative_blocks(narrative_id, block_key);

ALTER TABLE public.metro_narrative_blocks ENABLE ROW LEVEL SECURITY;

-- Blocks are readable by anyone with metro access (via narrative → metro)
CREATE POLICY "Users can read narrative blocks for accessible metros"
  ON public.metro_narrative_blocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.metro_narratives mn
      WHERE mn.id = metro_narrative_blocks.narrative_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'regional_lead') OR
        public.has_role(auth.uid(), 'leadership') OR
        public.has_metro_access(auth.uid(), mn.metro_id)
      )
    )
  );

-- No direct user writes (service role only)

-- 3) journal_entries — scribble anywhere notes
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metro_id uuid REFERENCES public.metros(id) ON DELETE SET NULL,
  narrative_id uuid REFERENCES public.metro_narratives(id) ON DELETE SET NULL,
  block_id uuid REFERENCES public.metro_narrative_blocks(id) ON DELETE SET NULL,
  anchor_key text,
  anchor_offset integer,
  note_text text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'leadership')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_user ON public.journal_entries(user_id, created_at DESC);
CREATE INDEX idx_journal_entries_narrative ON public.journal_entries(narrative_id, block_id);
CREATE INDEX idx_journal_entries_metro ON public.journal_entries(metro_id, created_at DESC);

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Users CRUD own entries
CREATE POLICY "Users can read own journal entries"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own journal entries"
  ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own journal entries"
  ON public.journal_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own journal entries"
  ON public.journal_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admin/leadership can read all
CREATE POLICY "Admins can read all journal entries"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'leadership')
  );

-- Regional leads can read entries for their metros
CREATE POLICY "Regional leads can read metro journal entries"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regional_lead') AND
    metro_id IS NOT NULL AND
    public.has_metro_access(auth.uid(), metro_id)
  );

-- 4) journal_extractions — AI-extracted metadata from journal entries
CREATE TABLE public.journal_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  extracted_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_journal_extractions_entry ON public.journal_extractions(journal_entry_id);

ALTER TABLE public.journal_extractions ENABLE ROW LEVEL SECURITY;

-- Mirror journal_entries access
CREATE POLICY "Users can read own journal extractions"
  ON public.journal_extractions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_extractions.journal_entry_id
      AND je.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all journal extractions"
  ON public.journal_extractions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'leadership')
  );

CREATE POLICY "Regional leads can read metro journal extractions"
  ON public.journal_extractions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regional_lead') AND
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_extractions.journal_entry_id
      AND je.metro_id IS NOT NULL
      AND public.has_metro_access(auth.uid(), je.metro_id)
    )
  );
