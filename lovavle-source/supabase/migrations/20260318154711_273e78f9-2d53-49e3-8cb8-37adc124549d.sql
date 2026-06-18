-- Add kickoff video path column to ibs table
ALTER TABLE public.ibs ADD COLUMN kickoff_video_path text DEFAULT NULL;

-- Create storage bucket for kickoff videos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kickoff-videos', 'kickoff-videos', false, 524288000);

-- RLS: Authenticated users can upload kickoff videos
CREATE POLICY "Authenticated can upload kickoff videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kickoff-videos');

-- RLS: Authenticated users can read kickoff videos
CREATE POLICY "Authenticated can read kickoff videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kickoff-videos');

-- RLS: Admins can delete kickoff videos
CREATE POLICY "Admins can delete kickoff videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kickoff-videos' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'global_admin'::public.app_role)
));