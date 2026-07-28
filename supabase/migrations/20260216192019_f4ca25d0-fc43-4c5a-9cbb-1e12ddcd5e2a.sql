-- Create storage bucket for KB document uploads (PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-uploads', 'kb-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can upload to kb-uploads
CREATE POLICY "Admins can upload KB files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kb-uploads'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can read KB files
CREATE POLICY "Admins can read KB files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kb-uploads'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete KB files
CREATE POLICY "Admins can delete KB files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kb-uploads'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);