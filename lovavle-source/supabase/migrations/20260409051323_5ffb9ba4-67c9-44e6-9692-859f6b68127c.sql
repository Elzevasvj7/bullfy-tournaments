
-- Table for AI analysis results of call recordings
CREATE TABLE public.lead_call_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.lead_calls(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  transcription TEXT,
  summary TEXT,
  success_score INTEGER DEFAULT 0,
  sentiment TEXT DEFAULT 'neutral',
  keywords TEXT[] DEFAULT '{}',
  sales_phase_reached TEXT,
  objections_detected TEXT[] DEFAULT '{}',
  objections_handled TEXT[] DEFAULT '{}',
  improvement_suggestions TEXT[] DEFAULT '{}',
  coaching_notes TEXT,
  analysis_model TEXT DEFAULT 'gemini',
  processing_status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(call_id)
);

-- Enable RLS
ALTER TABLE public.lead_call_analysis ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read analyses
CREATE POLICY "Authenticated users can read call analyses"
  ON public.lead_call_analysis
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role (edge functions) can insert/update
CREATE POLICY "Service can insert call analyses"
  ON public.lead_call_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update call analyses"
  ON public.lead_call_analysis
  FOR UPDATE
  TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_lead_call_analysis_call_id ON public.lead_call_analysis(call_id);
CREATE INDEX idx_lead_call_analysis_lead_id ON public.lead_call_analysis(lead_id);
CREATE INDEX idx_lead_call_analysis_agent_id ON public.lead_call_analysis(agent_id);
CREATE INDEX idx_lead_call_analysis_created ON public.lead_call_analysis(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_lead_call_analysis_updated_at
  BEFORE UPDATE ON public.lead_call_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
