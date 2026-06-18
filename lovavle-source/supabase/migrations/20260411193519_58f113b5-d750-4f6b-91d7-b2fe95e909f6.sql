
-- 1. Campaign Analyses
CREATE TABLE public.campaign_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL DEFAULT 'video',
  asset_url text NOT NULL,
  asset_name text,
  copy_text text,
  impact_score integer,
  segment_analysis jsonb DEFAULT '{}'::jsonb,
  suggestions jsonb DEFAULT '[]'::jsonb,
  raw_analysis text,
  analyzed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and marketing can view analyses"
  ON public.campaign_analyses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'marketing') OR
    public.has_role(auth.uid(), 'admin_ventas')
  );
CREATE POLICY "Admins and marketing can insert analyses"
  ON public.campaign_analyses FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'marketing')
  );
CREATE POLICY "Admins can delete analyses"
  ON public.campaign_analyses FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_campaign_analyses_updated_at
  BEFORE UPDATE ON public.campaign_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Video Clips
CREATE TABLE public.video_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL DEFAULT 'upload',
  source_id text,
  source_url text NOT NULL,
  title text,
  start_time numeric NOT NULL DEFAULT 0,
  end_time numeric NOT NULL DEFAULT 0,
  transcript_segment text,
  hook_score integer,
  hook_reason text,
  shotstack_render_id text,
  render_status text NOT NULL DEFAULT 'pending',
  output_url text,
  format text NOT NULL DEFAULT 'vertical',
  has_subtitles boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.video_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own clips"
  ON public.video_clips FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users insert own clips"
  ON public.video_clips FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users update own clips"
  ON public.video_clips FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins delete clips"
  ON public.video_clips FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_video_clips_updated_at
  BEFORE UPDATE ON public.video_clips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Video Studio Access
CREATE TABLE public.video_studio_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'free',
  enabled boolean NOT NULL DEFAULT false,
  can_publish_social boolean NOT NULL DEFAULT false,
  can_auto_clip boolean NOT NULL DEFAULT false,
  can_remove_branding boolean NOT NULL DEFAULT false,
  monthly_clip_limit integer NOT NULL DEFAULT 3,
  monthly_analysis_limit integer NOT NULL DEFAULT 5,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.video_studio_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own access"
  ON public.video_studio_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Only admins manage access"
  ON public.video_studio_access FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Only admins update access"
  ON public.video_studio_access FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Only admins delete access"
  ON public.video_studio_access FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_video_studio_access_updated_at
  BEFORE UPDATE ON public.video_studio_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Social Connections
CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  access_token_encrypted text,
  refresh_token_encrypted text,
  platform_user_id text,
  platform_username text,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own connections"
  ON public.social_connections FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users manage own connections"
  ON public.social_connections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own connections"
  ON public.social_connections FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users delete own connections"
  ON public.social_connections FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Social Publications
CREATE TABLE public.social_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid REFERENCES public.video_clips(id) ON DELETE SET NULL,
  social_connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  platform text NOT NULL,
  post_id text,
  post_url text,
  caption text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  metrics jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own publications"
  ON public.social_publications FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users insert own publications"
  ON public.social_publications FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users update own publications"
  ON public.social_publications FOR UPDATE TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "Admins delete publications"
  ON public.social_publications FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_social_publications_updated_at
  BEFORE UPDATE ON public.social_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Video Studio Usage Log
CREATE TABLE public.video_studio_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  credits_used integer NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.video_studio_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own usage"
  ON public.video_studio_usage_log FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "System inserts usage"
  ON public.video_studio_usage_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- 7. Storage bucket for processed clips
INSERT INTO storage.buckets (id, name, public) VALUES ('video-clips', 'video-clips', true);

CREATE POLICY "Authenticated users can upload clips"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'video-clips');
CREATE POLICY "Anyone can view clips"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'video-clips');
CREATE POLICY "Users can update own clips"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'video-clips');
CREATE POLICY "Admins can delete clips"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'video-clips');
