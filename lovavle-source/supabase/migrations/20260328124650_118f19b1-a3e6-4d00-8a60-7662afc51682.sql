
-- Table for saved CTAs per user
CREATE TABLE public.live_saved_ctas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  url text,
  button_text text DEFAULT 'Ver más',
  image_path text,
  image_only boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.live_saved_ctas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own CTAs" ON public.live_saved_ctas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage bucket for CTA images
INSERT INTO storage.buckets (id, name, public) VALUES ('live-cta-images', 'live-cta-images', true);

CREATE POLICY "Authenticated users can upload CTA images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'live-cta-images');

CREATE POLICY "Anyone can read CTA images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'live-cta-images');

CREATE POLICY "Users can delete own CTA images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'live-cta-images');
