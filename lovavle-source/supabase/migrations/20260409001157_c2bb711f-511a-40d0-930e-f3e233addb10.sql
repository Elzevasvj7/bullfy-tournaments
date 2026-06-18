
-- Sales agent status (real-time availability)
CREATE TABLE public.sales_agent_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('available','on_call','wrap_up','offline')),
  telefono_trabajo text,
  call_mode_preference text NOT NULL DEFAULT 'browser' CHECK (call_mode_preference IN ('browser','bridge')),
  current_lead_id uuid REFERENCES public.stream_leads(id) ON DELETE SET NULL,
  daily_calls integer NOT NULL DEFAULT 0,
  daily_duration_seconds integer NOT NULL DEFAULT 0,
  daily_reset_date date NOT NULL DEFAULT CURRENT_DATE,
  capacity_max integer NOT NULL DEFAULT 1,
  last_status_change timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_agent_status ENABLE ROW LEVEL SECURITY;

-- Agents see their own; supervisors see all
CREATE POLICY "Agents view own status" ON public.sales_agent_status
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Agents update own status" ON public.sales_agent_status
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Agents insert own status" ON public.sales_agent_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Supervisors can also update (for manual assignment)
CREATE POLICY "Supervisors update any status" ON public.sales_agent_status
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_sales_agent_status_updated_at
  BEFORE UPDATE ON public.sales_agent_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_agent_status;

-- Lead calls log
CREATE TABLE public.lead_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  twilio_call_sid text,
  call_mode text NOT NULL DEFAULT 'browser' CHECK (call_mode IN ('browser','bridge')),
  status text NOT NULL DEFAULT 'initiating' CHECK (status IN ('initiating','ringing','in_progress','completed','failed','no_answer','busy')),
  duration_seconds integer,
  recording_url text,
  recording_sid text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  disposition text CHECK (disposition IS NULL OR disposition IN ('interested','callback','not_interested','no_answer','wrong_number','voicemail')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own calls" ON public.lead_calls
  FOR SELECT USING (
    auth.uid() = agent_id
    OR public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Agents insert own calls" ON public.lead_calls
  FOR INSERT WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents update own calls" ON public.lead_calls
  FOR UPDATE USING (
    auth.uid() = agent_id
    OR public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_lead_calls_updated_at
  BEFORE UPDATE ON public.lead_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lead_calls_lead_id ON public.lead_calls(lead_id);
CREATE INDEX idx_lead_calls_agent_id ON public.lead_calls(agent_id);
CREATE INDEX idx_lead_calls_status ON public.lead_calls(status);

-- Lead assignments log
CREATE TABLE public.lead_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  assigned_by uuid,
  assignment_type text NOT NULL DEFAULT 'manual' CHECK (assignment_type IN ('manual','auto_round_robin','auto_score')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','completed','expired')),
  accepted_at timestamptz,
  completed_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own assignments" ON public.lead_assignments
  FOR SELECT USING (
    auth.uid() = agent_id
    OR public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Supervisors insert assignments" ON public.lead_assignments
  FOR INSERT WITH CHECK (
    auth.uid() = agent_id
    OR public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Update own or supervisor" ON public.lead_assignments
  FOR UPDATE USING (
    auth.uid() = agent_id
    OR public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_lead_assignments_updated_at
  BEFORE UPDATE ON public.lead_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lead_assignments_lead_id ON public.lead_assignments(lead_id);
CREATE INDEX idx_lead_assignments_agent_id ON public.lead_assignments(agent_id);
CREATE INDEX idx_lead_assignments_status ON public.lead_assignments(status);

-- Function to auto-reset daily counters
CREATE OR REPLACE FUNCTION public.reset_daily_agent_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.daily_reset_date < CURRENT_DATE THEN
    NEW.daily_calls := 0;
    NEW.daily_duration_seconds := 0;
    NEW.daily_reset_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reset_agent_daily_counters
  BEFORE UPDATE ON public.sales_agent_status
  FOR EACH ROW EXECUTE FUNCTION public.reset_daily_agent_counters();
