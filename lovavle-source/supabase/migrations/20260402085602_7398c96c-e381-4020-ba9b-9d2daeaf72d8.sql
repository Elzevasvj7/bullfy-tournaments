
-- Fake streams table
CREATE TABLE public.live_fake_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recording_id UUID REFERENCES public.live_recordings(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  video_path TEXT NOT NULL,
  video_source TEXT NOT NULL DEFAULT 'upload' CHECK (video_source IN ('recording', 'upload')),
  cta_url TEXT,
  cta_text TEXT DEFAULT 'Únete ahora',
  fake_viewer_min INTEGER NOT NULL DEFAULT 80,
  fake_viewer_max INTEGER NOT NULL DEFAULT 105,
  chat_messages JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_fake_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fake streams"
  ON public.live_fake_streams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can view active fake streams"
  ON public.live_fake_streams FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Users can create fake streams"
  ON public.live_fake_streams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their fake streams"
  ON public.live_fake_streams FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their fake streams"
  ON public.live_fake_streams FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_live_fake_streams_updated_at
  BEFORE UPDATE ON public.live_fake_streams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Virtual backgrounds table
CREATE TABLE public.live_virtual_backgrounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  bg_type TEXT NOT NULL DEFAULT 'image' CHECK (bg_type IN ('blur', 'image', 'video')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_virtual_backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view backgrounds"
  ON public.live_virtual_backgrounds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can upload backgrounds"
  ON public.live_virtual_backgrounds FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their backgrounds"
  ON public.live_virtual_backgrounds FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('fake-stream-videos', 'fake-stream-videos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('live-backgrounds', 'live-backgrounds', true);

-- Storage policies for fake-stream-videos
CREATE POLICY "Public can view fake stream videos"
  ON storage.objects FOR SELECT USING (bucket_id = 'fake-stream-videos');

CREATE POLICY "Authenticated can upload fake stream videos"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fake-stream-videos');

CREATE POLICY "Authenticated can delete fake stream videos"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fake-stream-videos');

-- Storage policies for live-backgrounds
CREATE POLICY "Public can view backgrounds"
  ON storage.objects FOR SELECT USING (bucket_id = 'live-backgrounds');

CREATE POLICY "Authenticated can upload backgrounds"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'live-backgrounds');

CREATE POLICY "Authenticated can delete backgrounds"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'live-backgrounds');
