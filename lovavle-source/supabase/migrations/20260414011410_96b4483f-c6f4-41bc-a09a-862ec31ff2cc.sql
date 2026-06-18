
CREATE TABLE public.brain_analysis_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name TEXT NOT NULL DEFAULT 'Sin nombre',
  copy_text TEXT,
  image_url TEXT,
  asset_type TEXT NOT NULL DEFAULT 'text',
  analysis_data JSONB NOT NULL,
  consensus_score INTEGER,
  viral_potential TEXT,
  agent_count INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view analysis history"
  ON public.brain_analysis_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert analysis history"
  ON public.brain_analysis_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can delete analysis history"
  ON public.brain_analysis_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));
