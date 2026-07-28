-- ============================================
-- Read.ai Integration Schema
-- ============================================

-- 1. Add name_aliases to profiles for nickname matching
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS name_aliases text[] DEFAULT '{}';

-- 2. Add readai_webhook_key to ai_user_settings
ALTER TABLE public.ai_user_settings 
ADD COLUMN IF NOT EXISTS readai_webhook_key uuid DEFAULT gen_random_uuid();

-- 3. Create meeting_notes table
CREATE TABLE public.meeting_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_calendar_event_id uuid REFERENCES public.google_calendar_events(id) ON DELETE SET NULL,
    source text NOT NULL DEFAULT 'read_ai',
    source_meeting_id text NOT NULL,
    meeting_title text NOT NULL,
    meeting_start_time timestamptz,
    meet_link text,
    summary text,
    action_items jsonb DEFAULT '[]'::jsonb,
    matched_action_items jsonb DEFAULT '[]'::jsonb,
    skipped_action_items jsonb DEFAULT '[]'::jsonb,
    recording_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meeting_notes_source_meeting_unique UNIQUE (user_id, source_meeting_id)
);

-- 4. Create meeting_note_contacts junction table
CREATE TABLE public.meeting_note_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_note_id uuid NOT NULL REFERENCES public.meeting_notes(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    is_primary boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meeting_note_contacts_unique UNIQUE (meeting_note_id, contact_id)
);

-- 5. Add source columns to contact_tasks
ALTER TABLE public.contact_tasks 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_meeting_note_id uuid REFERENCES public.meeting_notes(id) ON DELETE SET NULL;

-- 6. Enable RLS on new tables
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_note_contacts ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for meeting_notes
CREATE POLICY "Users can view their own meeting notes"
ON public.meeting_notes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meeting notes"
ON public.meeting_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting notes"
ON public.meeting_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting notes"
ON public.meeting_notes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 8. RLS policies for meeting_note_contacts
-- Users can view contacts linked to their meeting notes
CREATE POLICY "Users can view meeting note contacts for their notes"
ON public.meeting_note_contacts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.meeting_notes mn
        WHERE mn.id = meeting_note_id AND mn.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert meeting note contacts for their notes"
ON public.meeting_note_contacts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.meeting_notes mn
        WHERE mn.id = meeting_note_id AND mn.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete meeting note contacts for their notes"
ON public.meeting_note_contacts
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.meeting_notes mn
        WHERE mn.id = meeting_note_id AND mn.user_id = auth.uid()
    )
);

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_notes_user_id ON public.meeting_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_calendar_event ON public.meeting_notes(google_calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_source_meeting ON public.meeting_notes(source_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_note_contacts_note ON public.meeting_note_contacts(meeting_note_id);
CREATE INDEX IF NOT EXISTS idx_meeting_note_contacts_contact ON public.meeting_note_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tasks_source ON public.contact_tasks(source);
CREATE INDEX IF NOT EXISTS idx_contact_tasks_meeting_note ON public.contact_tasks(source_meeting_note_id);

-- 10. Add updated_at trigger for meeting_notes
CREATE TRIGGER update_meeting_notes_updated_at
    BEFORE UPDATE ON public.meeting_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 11. Enable realtime for meeting_notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_notes;