
-- 1. Add 'visitor' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visitor';

-- 2. Add 'Visit Note' to activity_type enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Visit Note';

-- 3. Create visit_assignments table
CREATE TABLE public.visit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('opportunity','contact','event')),
  subject_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, visitor_user_id, subject_type, subject_id)
);

ALTER TABLE public.visit_assignments ENABLE ROW LEVEL SECURITY;

-- Admins/staff manage assignments
CREATE POLICY "Admin/staff manage visit_assignments"
  ON public.visit_assignments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','steward','staff','leadership']::app_role[]));

-- Visitors see their own assignments
CREATE POLICY "Visitors see own assignments"
  ON public.visit_assignments FOR SELECT TO authenticated
  USING (visitor_user_id = auth.uid());

-- 4. Create voice_notes table
CREATE TABLE public.voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('opportunity','contact','event','activity','reflection')),
  subject_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  audio_path text,
  audio_mime text,
  audio_seconds int,
  transcript text,
  transcript_status text NOT NULL DEFAULT 'pending' CHECK (transcript_status IN ('pending','processing','completed','failed')),
  transcript_provider text,
  transcript_confidence numeric,
  error jsonb,
  source_activity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_notes_tenant_recorded ON public.voice_notes (tenant_id, recorded_at DESC);
CREATE INDEX idx_voice_notes_user_recorded ON public.voice_notes (user_id, recorded_at DESC);
CREATE INDEX idx_voice_notes_subject ON public.voice_notes (subject_type, subject_id);

ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Admin/staff can see all voice notes in tenant
CREATE POLICY "Staff see tenant voice_notes"
  ON public.voice_notes FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','steward','staff','leadership']::app_role[]));

-- Users can see their own voice notes
CREATE POLICY "Users see own voice_notes"
  ON public.voice_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own voice notes
CREATE POLICY "Users insert own voice_notes"
  ON public.voice_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own voice notes
CREATE POLICY "Users update own voice_notes"
  ON public.voice_notes FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 5. Create tenant_voice_settings table
CREATE TABLE public.tenant_voice_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enable_voice_notes boolean NOT NULL DEFAULT true,
  store_audio boolean NOT NULL DEFAULT true,
  max_audio_seconds int NOT NULL DEFAULT 180,
  max_audio_mb int NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_tenant_voice_settings_updated_at
  BEFORE UPDATE ON public.tenant_voice_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tenant_voice_settings ENABLE ROW LEVEL SECURITY;

-- Admin/steward manage voice settings
CREATE POLICY "Admin manage tenant_voice_settings"
  ON public.tenant_voice_settings FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[]));

-- Staff can read voice settings
CREATE POLICY "Staff read tenant_voice_settings"
  ON public.tenant_voice_settings FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['staff','leadership']::app_role[]));

-- 6. Create voice-notes storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their own path
CREATE POLICY "Users upload own voice notes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[3] = 'user'
    AND (storage.foldername(name))[4] = auth.uid()::text
  );

-- Users can read their own voice notes
CREATE POLICY "Users read own voice notes"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[4] = auth.uid()::text
  );

-- Admin can read all voice notes in bucket
CREATE POLICY "Admin read all voice notes"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[])
  );

-- Service role can delete (for audio cleanup)
CREATE POLICY "Service delete voice notes"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (
      (storage.foldername(name))[4] = auth.uid()::text
      OR public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[])
    )
  );
