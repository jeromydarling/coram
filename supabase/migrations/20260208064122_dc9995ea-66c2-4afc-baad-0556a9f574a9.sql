
-- ============================================================
-- AI Knowledge Base: company-level authoritative documents
-- ============================================================

-- Main documents table
CREATE TABLE public.ai_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  content_markdown text NOT NULL,
  content_json jsonb NULL,
  active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  source_urls text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Version history
CREATE TABLE public.ai_knowledge_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE,
  version int NOT NULL,
  content_markdown text NOT NULL,
  content_json jsonb NULL,
  source_urls text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, version)
);

-- Indexes
CREATE INDEX idx_ai_kb_docs_key ON public.ai_knowledge_documents(key);
CREATE INDEX idx_ai_kb_docs_active ON public.ai_knowledge_documents(active);
CREATE INDEX idx_ai_kb_versions_doc ON public.ai_knowledge_document_versions(document_id);

-- updated_at trigger
CREATE TRIGGER set_ai_kb_docs_updated_at
  BEFORE UPDATE ON public.ai_knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_document_versions ENABLE ROW LEVEL SECURITY;

-- Read: authenticated staff/regional_lead/admin can read active docs
CREATE POLICY "Authenticated users can read active KB docs"
  ON public.ai_knowledge_documents FOR SELECT TO authenticated
  USING (
    active = true
    AND public.has_any_role(auth.uid(), ARRAY['admin', 'regional_lead', 'staff', 'leadership']::app_role[])
  );

-- Admin can read ALL docs (including inactive)
CREATE POLICY "Admin can read all KB docs"
  ON public.ai_knowledge_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert/update/delete
CREATE POLICY "Admin can insert KB docs"
  ON public.ai_knowledge_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update KB docs"
  ON public.ai_knowledge_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete KB docs"
  ON public.ai_knowledge_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Versions: same pattern
CREATE POLICY "Authenticated users can read KB versions"
  ON public.ai_knowledge_document_versions FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'regional_lead', 'staff', 'leadership']::app_role[])
  );

CREATE POLICY "Admin can insert KB versions"
  ON public.ai_knowledge_document_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default documents (placeholders only — no invented facts)
INSERT INTO public.ai_knowledge_documents (key, title, content_markdown, created_by) VALUES
(
  'company_profile',
  'PCs for People — Company Profile',
  E'# PCs for People\n\n*This is a placeholder. An admin should update this with the authoritative company profile.*\n\n## Mission\n[Add mission statement]\n\n## Who We Serve\n[Add target populations]\n\n## Programs\n[Add program descriptions]\n\n## Key Stats\n[Add verified statistics]',
  '00000000-0000-0000-0000-000000000000'
),
(
  'email_tone',
  'Email Tone & Style',
  E'# Email Tone & Style Guide\n\n*This is a placeholder. An admin should update this with approved tone and style guidelines.*\n\n## Voice\n- Professional yet approachable\n- Mission-driven\n- Clear and concise\n\n## Formatting\n- Short paragraphs\n- Clear call to action\n- Personalized greetings',
  '00000000-0000-0000-0000-000000000000'
),
(
  'approved_claims',
  'Approved Claims',
  E'# Approved Claims\n\n*This is a placeholder. An admin should update this with verified, approved claims.*\n\n- [Add verified claim 1]\n- [Add verified claim 2]\n- [Add verified claim 3]\n\n## Disallowed / Unverified Claims\n- Do not make specific numerical claims without verification\n- Do not claim partnerships that are not confirmed',
  '00000000-0000-0000-0000-000000000000'
);

-- Also seed initial versions for each
INSERT INTO public.ai_knowledge_document_versions (document_id, version, content_markdown, source_urls, created_by)
SELECT id, 1, content_markdown, source_urls, created_by
FROM public.ai_knowledge_documents;
