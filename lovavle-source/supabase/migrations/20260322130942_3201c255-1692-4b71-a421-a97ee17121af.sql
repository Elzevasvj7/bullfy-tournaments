-- Create storage bucket for promotion images
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for promotions bucket
CREATE POLICY "Authenticated can upload promotion images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'promotions');

CREATE POLICY "Anyone can view promotion images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'promotions');

CREATE POLICY "Authenticated can delete promotion images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'promotions');

-- Update promotions RLS to include marketing role
DROP POLICY IF EXISTS "Admins can manage promotions" ON public.ib_portal_promotions;
CREATE POLICY "Admins and marketing can manage promotions"
ON public.ib_portal_promotions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));