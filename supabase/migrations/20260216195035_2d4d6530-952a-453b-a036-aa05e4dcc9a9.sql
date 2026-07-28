-- Allow admins to upload to kb-uploads bucket
CREATE POLICY "Admins can upload to kb-uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kb-uploads'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to read from kb-uploads bucket (needed for edge function download via user client)
CREATE POLICY "Admins can read kb-uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kb-uploads'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow service role to delete from kb-uploads (cleanup after processing)
CREATE POLICY "Service role can delete kb-uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kb-uploads'
);