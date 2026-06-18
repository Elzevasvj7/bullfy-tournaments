
-- Recordings table
CREATE TABLE public.live_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.live_rooms(id) ON DELETE CASCADE NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  recorded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recordings" ON public.live_recordings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert recordings" ON public.live_recordings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can delete recordings" ON public.live_recordings
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
  );

-- Reactions table
CREATE TABLE public.live_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.live_rooms(id) ON DELETE CASCADE NOT NULL,
  user_name text NOT NULL,
  reaction_type text NOT NULL DEFAULT 'emoji',
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reactions" ON public.live_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can insert reactions" ON public.live_reactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Overlay assets table (stickers and videos that hosts upload)
CREATE TABLE public.live_overlay_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'sticker',
  file_path text NOT NULL,
  thumbnail_path text,
  duration_seconds integer,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_overlay_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view overlay assets" ON public.live_overlay_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert overlay assets" ON public.live_overlay_assets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can delete own overlay assets" ON public.live_overlay_assets
  FOR DELETE TO authenticated USING (true);

-- Add stats columns to live_rooms
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS total_likes integer DEFAULT 0;
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS total_reactions integer DEFAULT 0;
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS peak_viewers integer DEFAULT 0;

-- Storage bucket for recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('live-recordings', 'live-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket for overlay assets
INSERT INTO storage.buckets (id, name, public) VALUES ('live-overlays', 'live-overlays', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recordings
CREATE POLICY "Auth users can upload recordings" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'live-recordings');

CREATE POLICY "Auth users can read recordings" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'live-recordings');

CREATE POLICY "Admins can delete recordings" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'live-recordings' AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
    )
  );

-- Storage policies for overlays
CREATE POLICY "Auth users can upload overlays" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'live-overlays');

CREATE POLICY "Anyone can read overlays" ON storage.objects
  FOR SELECT USING (bucket_id = 'live-overlays');

CREATE POLICY "Auth users can delete overlays" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'live-overlays');

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
