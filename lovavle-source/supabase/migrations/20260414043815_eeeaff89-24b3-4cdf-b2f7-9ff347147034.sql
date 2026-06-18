
INSERT INTO storage.buckets (id, name, public)
VALUES ('newsletter-images', 'newsletter-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Newsletter images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'newsletter-images');

CREATE POLICY "Service role can upload newsletter images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'newsletter-images');

CREATE POLICY "Service role can update newsletter images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'newsletter-images');

CREATE POLICY "Service role can delete newsletter images"
ON storage.objects FOR DELETE
USING (bucket_id = 'newsletter-images');
