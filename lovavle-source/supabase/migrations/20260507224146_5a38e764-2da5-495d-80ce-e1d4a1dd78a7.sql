-- Brand templates per portal for Video Studio
CREATE TABLE IF NOT EXISTS public.portal_video_brand_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL UNIQUE REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  primary_color TEXT NOT NULL DEFAULT '#146EF5',
  secondary_color TEXT NOT NULL DEFAULT '#062B63',
  subtitle_color TEXT NOT NULL DEFAULT '#FFFFFF',
  subtitle_bg_color TEXT NOT NULL DEFAULT 'rgba(0,0,0,0.5)',
  subtitle_font TEXT NOT NULL DEFAULT 'Montserrat',
  subtitle_font_size INT NOT NULL DEFAULT 42,
  subtitle_position TEXT NOT NULL DEFAULT 'bottom',
  logo_url TEXT,
  watermark_text TEXT,
  watermark_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_video_brand_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal admins manage brand config"
ON public.portal_video_brand_config
FOR ALL
TO authenticated
USING (public.is_portal_admin(portal_id))
WITH CHECK (public.is_portal_admin(portal_id));

CREATE POLICY "Service role full access brand config"
ON public.portal_video_brand_config
FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_portal_video_brand_config_updated_at
BEFORE UPDATE ON public.portal_video_brand_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();