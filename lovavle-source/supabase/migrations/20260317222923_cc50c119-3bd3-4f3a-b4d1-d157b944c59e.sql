
-- BCE Call Flows (scenario definitions)
CREATE TABLE public.bce_call_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_lead TEXT NOT NULL, -- IB, trader, inversionista
  objetivo TEXT NOT NULL,  -- prop, broker, copy, bullfy
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BCE Scripts (guided phrases per flow/phase)
CREATE TABLE public.bce_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID REFERENCES public.bce_call_flows(id) ON DELETE CASCADE NOT NULL,
  fase TEXT NOT NULL, -- apertura, diagnostico, presentacion, objeciones, cierre
  texto_corto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BCE Objections bank
CREATE TABLE public.bce_objections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  texto_objecion TEXT NOT NULL,
  respuesta_logica TEXT NOT NULL,
  respuesta_emocional TEXT NOT NULL,
  reframe TEXT NOT NULL,
  contra_pregunta TEXT NOT NULL,
  cierre_sugerido TEXT NOT NULL,
  categoria TEXT, -- confianza, dinero, competencia, riesgo, conocimiento
  source TEXT DEFAULT 'manual', -- manual, ai_import
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BCE Call Sessions (tracks each BD call)
CREATE TABLE public.bce_call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bd_id UUID NOT NULL,
  flow_id UUID REFERENCES public.bce_call_flows(id),
  -- Lead profiling
  capital TEXT DEFAULT 'medio', -- alto, medio, bajo, cero
  experiencia TEXT DEFAULT 'media', -- alta, media, baja
  interes TEXT DEFAULT 'medio', -- alto, medio, bajo
  objeciones_detectadas TEXT[] DEFAULT '{}',
  temperatura TEXT DEFAULT 'tibio', -- caliente, tibio, frio
  probabilidad_cierre INTEGER DEFAULT 50,
  -- Gamification
  score INTEGER DEFAULT 0,
  medallas TEXT[] DEFAULT '{}',
  -- Tracking
  fase_actual TEXT DEFAULT 'apertura',
  respuestas_usadas INTEGER DEFAULT 0,
  objeciones_manejadas INTEGER DEFAULT 0,
  resultado TEXT, -- cerrado, no_cerrado, seguimiento
  notas TEXT,
  is_training BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.bce_call_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bce_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bce_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bce_call_sessions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read flows, scripts, objections
CREATE POLICY "Authenticated can read call flows" ON public.bce_call_flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read scripts" ON public.bce_scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read objections" ON public.bce_objections FOR SELECT TO authenticated USING (true);

-- Admins can manage flows, scripts, objections
CREATE POLICY "Admins can manage call flows" ON public.bce_call_flows FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

CREATE POLICY "Admins can manage scripts" ON public.bce_scripts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

CREATE POLICY "Admins can manage objections" ON public.bce_objections FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

-- BDs can insert objections (from AI import)
CREATE POLICY "BDs can insert objections" ON public.bce_objections FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'bd'::app_role) OR has_role(auth.uid(), 'admin_bd'::app_role));

-- Call sessions: BDs can manage own, admins can read all
CREATE POLICY "BDs can manage own sessions" ON public.bce_call_sessions FOR ALL TO authenticated
  USING (bd_id = auth.uid()) WITH CHECK (bd_id = auth.uid());

CREATE POLICY "Admins can read all sessions" ON public.bce_call_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'admin_bd'::app_role));
