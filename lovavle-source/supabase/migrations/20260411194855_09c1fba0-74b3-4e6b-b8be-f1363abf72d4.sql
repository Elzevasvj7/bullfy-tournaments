
-- Add video studio access flag to partner portals
ALTER TABLE public.partner_portals ADD COLUMN IF NOT EXISTS video_studio_enabled boolean NOT NULL DEFAULT false;

-- Table for per-portal social media credentials
CREATE TABLE public.portal_social_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_account_name text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'configured', 'connected', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portal_id, platform)
);

ALTER TABLE public.portal_social_credentials ENABLE ROW LEVEL SECURITY;

-- IB owners can manage their own portal credentials
CREATE POLICY "Portal owners can manage social credentials"
ON public.portal_social_credentials
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partner_portals pp
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE pp.id = portal_social_credentials.portal_id
    AND p.id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'global_admin')
);

-- Admins can toggle video_studio_enabled (already covered by existing partner_portals policies)

CREATE TRIGGER update_portal_social_credentials_updated_at
BEFORE UPDATE ON public.portal_social_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
