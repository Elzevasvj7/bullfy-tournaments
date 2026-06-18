
INSERT INTO storage.buckets (id, name, public) VALUES ('call-audio', 'call-audio', true);

CREATE POLICY "Public read access for call audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'call-audio');

CREATE POLICY "Authenticated users can upload call audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'call-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update call audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'call-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete call audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'call-audio' AND auth.role() = 'authenticated');
