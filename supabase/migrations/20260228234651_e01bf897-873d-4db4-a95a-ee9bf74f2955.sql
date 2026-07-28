
-- Add hero_image_url to both essay tables
ALTER TABLE public.library_essays ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE public.operator_content_drafts ADD COLUMN IF NOT EXISTS hero_image_url text;

-- Create storage bucket for essay images
INSERT INTO storage.buckets (id, name, public)
VALUES ('essay-images', 'essay-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for essay images
CREATE POLICY "Essay images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'essay-images');

-- Service role can upload essay images (edge function uses service role)
CREATE POLICY "Service role can upload essay images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'essay-images');

CREATE POLICY "Service role can update essay images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'essay-images');
