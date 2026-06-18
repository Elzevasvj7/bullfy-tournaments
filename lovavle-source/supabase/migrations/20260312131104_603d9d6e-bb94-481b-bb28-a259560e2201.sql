
-- Experience leads table
CREATE TABLE public.experience_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid,
  nombre text,
  correo text,
  telefono text,
  pais text,
  empresa text,
  tamano_comunidad text,
  interes text,
  comentario text,
  status text NOT NULL DEFAULT 'nuevo',
  assigned_bd uuid,
  opportunity_score integer DEFAULT 0,
  level text DEFAULT 'Explorer',
  tools_used text[] DEFAULT '{}',
  badges text[] DEFAULT '{}',
  progress_stage integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Experience simulations table
CREATE TABLE public.experience_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  lead_id uuid REFERENCES public.experience_leads(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}',
  results jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.experience_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_simulations ENABLE ROW LEVEL SECURITY;

-- Public access policies (module is 100% public)
CREATE POLICY "Anyone can insert leads" ON public.experience_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read leads" ON public.experience_leads FOR SELECT USING (true);
CREATE POLICY "Anyone can update leads" ON public.experience_leads FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert simulations" ON public.experience_simulations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read simulations" ON public.experience_simulations FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_experience_leads_updated_at
  BEFORE UPDATE ON public.experience_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
