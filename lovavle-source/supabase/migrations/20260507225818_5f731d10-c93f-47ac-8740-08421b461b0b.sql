-- ============== TABLES ==============

CREATE TABLE public.clip_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_clip_id UUID NOT NULL REFERENCES public.video_clips(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  hook_offset_seconds NUMERIC NOT NULL DEFAULT 0,
  caption TEXT,
  shotstack_render_id TEXT,
  output_url TEXT,
  render_status TEXT NOT NULL DEFAULT 'rendering',
  metrics JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clip_variants_parent ON public.clip_variants(parent_clip_id);
ALTER TABLE public.clip_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins manage variants" ON public.clip_variants
  FOR ALL USING (
    public.is_global_admin() OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.video_clips vc WHERE vc.id = parent_clip_id AND vc.created_by = auth.uid())
  );

CREATE TABLE public.clip_voiceovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id UUID NOT NULL REFERENCES public.video_clips(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'es',
  voice_id TEXT NOT NULL,
  voice_name TEXT,
  text_used TEXT NOT NULL,
  audio_url TEXT,
  output_video_url TEXT,
  shotstack_render_id TEXT,
  status TEXT NOT NULL DEFAULT 'generating',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clip_voiceovers_clip ON public.clip_voiceovers(clip_id);
ALTER TABLE public.clip_voiceovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins manage voiceovers" ON public.clip_voiceovers
  FOR ALL USING (
    public.is_global_admin() OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.video_clips vc WHERE vc.id = clip_id AND vc.created_by = auth.uid())
  );

CREATE TABLE public.clip_carousels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id UUID REFERENCES public.video_clips(id) ON DELETE CASCADE,
  title TEXT,
  caption TEXT,
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clip_carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins manage carousels" ON public.clip_carousels
  FOR ALL USING (
    public.is_global_admin() OR created_by = auth.uid()
  );

CREATE TABLE public.portal_broll_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID,
  asset_type TEXT NOT NULL DEFAULT 'image',
  asset_url TEXT NOT NULL,
  label TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_broll_portal ON public.portal_broll_library(portal_id);
ALTER TABLE public.portal_broll_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view portal broll" ON public.portal_broll_library FOR SELECT USING (true);
CREATE POLICY "Portal admins can manage broll" ON public.portal_broll_library
  FOR ALL USING (
    portal_id IS NULL AND public.is_global_admin()
    OR (portal_id IS NOT NULL AND public.is_portal_admin(portal_id))
  )
  WITH CHECK (
    portal_id IS NULL AND public.is_global_admin()
    OR (portal_id IS NOT NULL AND public.is_portal_admin(portal_id))
  );

-- ============== STORAGE BUCKETS ==============
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES
  ('clip-voiceovers', 'clip-voiceovers', true, 52428800),
  ('clip-broll', 'clip-broll', true, 104857600)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "voiceovers public read" ON storage.objects FOR SELECT USING (bucket_id = 'clip-voiceovers');
CREATE POLICY "voiceovers authenticated write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clip-voiceovers' AND auth.uid() IS NOT NULL);
CREATE POLICY "broll public read" ON storage.objects FOR SELECT USING (bucket_id = 'clip-broll');
CREATE POLICY "broll authenticated write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clip-broll' AND auth.uid() IS NOT NULL);
CREATE POLICY "broll authenticated delete" ON storage.objects FOR DELETE USING (bucket_id = 'clip-broll' AND auth.uid() IS NOT NULL);