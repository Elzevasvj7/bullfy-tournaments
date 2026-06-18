
CREATE TABLE public.campaign_presentations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  campaign_name TEXT NOT NULL DEFAULT 'Sin nombre',
  copy_text TEXT,
  image_url TEXT,
  analysis_data JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view presentations"
ON public.campaign_presentations FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create presentations"
ON public.campaign_presentations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete their presentations"
ON public.campaign_presentations FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

CREATE INDEX idx_campaign_presentations_slug ON public.campaign_presentations (slug);
