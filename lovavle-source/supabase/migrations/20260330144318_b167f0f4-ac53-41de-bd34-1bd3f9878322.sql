
-- Ad campaigns table
CREATE TABLE public.live_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_path text NOT NULL,
  frequency_seconds integer NOT NULL DEFAULT 300,
  duration_seconds integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  portal_ids uuid[] DEFAULT '{}',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.live_ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing and admins can manage ad campaigns" ON public.live_ad_campaigns
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'global_admin'::app_role) OR 
    has_role(auth.uid(), 'marketing'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'global_admin'::app_role) OR 
    has_role(auth.uid(), 'marketing'::app_role)
  );

CREATE POLICY "Authenticated can read active ad campaigns" ON public.live_ad_campaigns
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Anon can read active ad campaigns" ON public.live_ad_campaigns
  FOR SELECT TO anon USING (active = true);

-- Storage bucket for ad images
INSERT INTO storage.buckets (id, name, public) VALUES ('live-ads', 'live-ads', true);

CREATE POLICY "Marketing and admins can upload ad images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'live-ads' AND (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'global_admin'::public.app_role) OR
      public.has_role(auth.uid(), 'marketing'::public.app_role)
    )
  );

CREATE POLICY "Marketing and admins can delete ad images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'live-ads' AND (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'global_admin'::public.app_role) OR
      public.has_role(auth.uid(), 'marketing'::public.app_role)
    )
  );

CREATE POLICY "Anyone can read ad images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'live-ads');
