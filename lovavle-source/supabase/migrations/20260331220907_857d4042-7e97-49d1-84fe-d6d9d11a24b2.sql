
CREATE TABLE public.lead_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  display_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pipeline stages" ON public.lead_pipeline_stages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage pipeline stages" ON public.lead_pipeline_stages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'admin_ventas'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'admin_ventas'::app_role));

CREATE TABLE public.stream_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  correo text NOT NULL,
  telefono text,
  source text NOT NULL DEFAULT 'stream',
  pipeline_stage_id uuid REFERENCES public.lead_pipeline_stages(id) ON DELETE SET NULL,
  assigned_to uuid,
  assigned_by uuid,
  assigned_at timestamptz,
  opportunity_score integer NOT NULL DEFAULT 0,
  stream_count integer NOT NULL DEFAULT 0,
  partner_portal_id uuid REFERENCES public.partner_portals(id) ON DELETE SET NULL,
  is_registered_partner boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stream_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead roles can read stream leads" ON public.stream_leads
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) 
    OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) 
    OR has_role(auth.uid(), 'admin_ventas'::app_role)
  );

CREATE POLICY "Admin ventas and admins can manage stream leads" ON public.stream_leads
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) 
    OR has_role(auth.uid(), 'admin_ventas'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) 
    OR has_role(auth.uid(), 'admin_ventas'::app_role)
  );

CREATE POLICY "Ventas can update assigned leads" ON public.stream_leads
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() AND has_role(auth.uid(), 'ventas'::app_role))
  WITH CHECK (assigned_to = auth.uid() AND has_role(auth.uid(), 'ventas'::app_role));

CREATE POLICY "Anon can insert stream leads" ON public.stream_leads
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated can insert stream leads" ON public.stream_leads
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role)
    OR has_role(auth.uid(), 'admin_ventas'::app_role)
  );

CREATE TABLE public.stream_lead_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  duration_seconds integer DEFAULT 0
);

ALTER TABLE public.stream_lead_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead roles can read participations" ON public.stream_lead_participations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) 
    OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) 
    OR has_role(auth.uid(), 'admin_ventas'::app_role)
  );

CREATE POLICY "Anon can insert participations" ON public.stream_lead_participations
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update participations" ON public.stream_lead_participations
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  performed_by uuid,
  activity_type text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead roles can read activities" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) 
    OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) 
    OR has_role(auth.uid(), 'admin_ventas'::app_role)
  );

CREATE POLICY "Lead roles can insert activities" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) 
    OR has_role(auth.uid(), 'admin_ventas'::app_role) OR has_role(auth.uid(), 'ventas'::app_role)
  );

INSERT INTO public.lead_pipeline_stages (name, color, display_order, is_default, is_closed) VALUES
  ('Nuevo', '#3B82F6', 0, true, false),
  ('Contactado', '#F59E0B', 1, false, false),
  ('Interesado', '#8B5CF6', 2, false, false),
  ('Negociación', '#F97316', 3, false, false),
  ('Cerrado Ganado', '#10B981', 4, false, true),
  ('Cerrado Perdido', '#EF4444', 5, false, true);

CREATE TRIGGER update_stream_leads_updated_at BEFORE UPDATE ON public.stream_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_pipeline_stages_updated_at BEFORE UPDATE ON public.lead_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Anon can also read pipeline stages for open streams
CREATE POLICY "Anon can read pipeline stages" ON public.lead_pipeline_stages
  FOR SELECT TO anon USING (true);
