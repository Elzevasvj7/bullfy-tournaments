
-- Tabla de prospectos IB gestionados por BDs
CREATE TABLE public.bd_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bd_user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  correo TEXT,
  telefono TEXT,
  empresa TEXT,
  pais TEXT,
  notas TEXT,
  opportunity_score INT NOT NULL DEFAULT 0,
  pipeline_stage_id UUID REFERENCES public.lead_pipeline_stages(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bd_prospects ENABLE ROW LEVEL SECURITY;

-- BDs ven solo sus prospectos
CREATE POLICY "BD can view own prospects"
  ON public.bd_prospects FOR SELECT
  TO authenticated
  USING (
    bd_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- BDs crean prospectos a su nombre
CREATE POLICY "BD can insert own prospects"
  ON public.bd_prospects FOR INSERT
  TO authenticated
  WITH CHECK (
    bd_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- BDs editan solo sus prospectos
CREATE POLICY "BD can update own prospects"
  ON public.bd_prospects FOR UPDATE
  TO authenticated
  USING (
    bd_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- Trigger para updated_at
CREATE TRIGGER update_bd_prospects_updated_at
  BEFORE UPDATE ON public.bd_prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
