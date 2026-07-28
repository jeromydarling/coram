-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to view documents
CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to delete their own uploads or admins any
CREATE POLICY "Users can delete own documents or admins any"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT DEFAULT 'general',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document attachments junction table
CREATE TABLE public.document_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  attached_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_target CHECK (contact_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Authenticated users can view documents"
ON public.documents FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload documents"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND uploaded_by = auth.uid());

CREATE POLICY "Users can update own documents or admins any"
ON public.documents FOR UPDATE
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR uploaded_by = auth.uid()
);

CREATE POLICY "Users can delete own documents or admins any"
ON public.documents FOR DELETE
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR uploaded_by = auth.uid()
);

-- Document attachments policies
CREATE POLICY "Authenticated users can view attachments"
ON public.document_attachments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create attachments"
ON public.document_attachments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND attached_by = auth.uid());

CREATE POLICY "Users can delete own attachments or admins any"
ON public.document_attachments FOR DELETE
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR attached_by = auth.uid()
);

-- Add indexes
CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_document_attachments_document ON public.document_attachments(document_id);
CREATE INDEX idx_document_attachments_contact ON public.document_attachments(contact_id);
CREATE INDEX idx_document_attachments_opportunity ON public.document_attachments(opportunity_id);