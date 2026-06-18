
-- Table for portal branding configuration
CREATE TABLE public.partner_portal_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT '#146EF5',
  accent_color text NOT NULL DEFAULT '#83CBFF',
  logo_path text,
  login_bg_image_path text,
  login_bg_color text DEFAULT '#062B63',
  display_name_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portal_id)
);

ALTER TABLE public.partner_portal_branding ENABLE ROW LEVEL SECURITY;

-- Admins (system) can manage all branding
CREATE POLICY "Admins can manage portal branding" ON public.partner_portal_branding
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

-- Portal owner (host_id on live_rooms or the IB owner) can manage their portal branding
CREATE POLICY "Portal owner can manage branding" ON public.partner_portal_branding
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = partner_portal_branding.portal_id
      AND i.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = partner_portal_branding.portal_id
      AND i.created_by = auth.uid()
    )
  );

-- Anyone can read branding (needed for login page)
CREATE POLICY "Anyone can read portal branding" ON public.partner_portal_branding
  FOR SELECT TO anon, authenticated
  USING (true);

-- Storage bucket for portal branding assets
INSERT INTO storage.buckets (id, name, public) VALUES ('portal-branding', 'portal-branding', true);

-- Storage policies
CREATE POLICY "Anyone can read portal branding files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'portal-branding');

CREATE POLICY "Authenticated can upload portal branding" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portal-branding');

CREATE POLICY "Authenticated can update portal branding" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portal-branding')
  WITH CHECK (bucket_id = 'portal-branding');

CREATE POLICY "Authenticated can delete portal branding" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portal-branding');

-- Auto-update updated_at
CREATE TRIGGER update_partner_portal_branding_updated_at
  BEFORE UPDATE ON public.partner_portal_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
