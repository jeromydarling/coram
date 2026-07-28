-- Create storage bucket for feedback attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'video/mp4', 'video/quicktime']
);

-- Storage RLS policies for feedback attachments
CREATE POLICY "Users can upload their own feedback attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'feedback-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own feedback attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'feedback-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all feedback attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'feedback-attachments' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Users can delete their own feedback attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'feedback-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create feedback_attachments table to link files to feedback requests
CREATE TABLE public.feedback_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.feedback_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments for their own feedback
CREATE POLICY "Users can view their own feedback attachments"
ON public.feedback_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.feedback_requests
    WHERE feedback_requests.id = feedback_attachments.feedback_id
      AND feedback_requests.user_id = auth.uid()
  )
);

-- Users can insert attachments for their own feedback
CREATE POLICY "Users can insert attachments for their own feedback"
ON public.feedback_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.feedback_requests
    WHERE feedback_requests.id = feedback_attachments.feedback_id
      AND feedback_requests.user_id = auth.uid()
  )
);

-- Users can delete their own attachments
CREATE POLICY "Users can delete their own feedback attachments"
ON public.feedback_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid()
);

-- Admins can view all attachments
CREATE POLICY "Admins can view all feedback attachments"
ON public.feedback_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);