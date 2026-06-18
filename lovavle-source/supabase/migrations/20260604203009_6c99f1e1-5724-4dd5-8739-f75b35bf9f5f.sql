
-- ============ SLA CONFIG ============
CREATE TABLE public.lead_sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_stage_id uuid REFERENCES public.lead_pipeline_stages(id) ON DELETE CASCADE,
  first_contact_minutes integer NOT NULL DEFAULT 30,
  follow_up_hours integer NOT NULL DEFAULT 24,
  max_days_in_stage integer NOT NULL DEFAULT 7,
  auto_escalate boolean NOT NULL DEFAULT false,
  escalate_to_role text,
  notify_closer boolean NOT NULL DEFAULT true,
  notify_admin boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_stage_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sla_config TO authenticated;
GRANT ALL ON public.lead_sla_config TO service_role;
ALTER TABLE public.lead_sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_config_admin_all" ON public.lead_sla_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'));
CREATE POLICY "sla_config_read_all" ON public.lead_sla_config FOR SELECT TO authenticated USING (true);

-- ============ SLA VIOLATIONS ============
CREATE TABLE public.lead_sla_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  pipeline_stage_id uuid REFERENCES public.lead_pipeline_stages(id) ON DELETE SET NULL,
  violation_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  closer_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_sla_violations_lead ON public.lead_sla_violations(lead_id);
CREATE INDEX idx_lead_sla_violations_unresolved ON public.lead_sla_violations(resolved_at) WHERE resolved_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sla_violations TO authenticated;
GRANT ALL ON public.lead_sla_violations TO service_role;
ALTER TABLE public.lead_sla_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_viol_admin_all" ON public.lead_sla_violations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'));
CREATE POLICY "sla_viol_closer_own" ON public.lead_sla_violations FOR SELECT TO authenticated
  USING (closer_id = auth.uid());

-- ============ NURTURING SEQUENCES ============
CREATE TABLE public.lead_nurturing_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL DEFAULT 'manual',
  trigger_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_nurturing_sequences TO authenticated;
GRANT ALL ON public.lead_nurturing_sequences TO service_role;
ALTER TABLE public.lead_nurturing_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nurt_seq_admin_all" ON public.lead_nurturing_sequences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas') OR public.has_role(auth.uid(),'marketing'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas') OR public.has_role(auth.uid(),'marketing'));
CREATE POLICY "nurt_seq_read_all" ON public.lead_nurturing_sequences FOR SELECT TO authenticated USING (true);

-- ============ NURTURING STEPS ============
CREATE TABLE public.lead_nurturing_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.lead_nurturing_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  day_offset integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'email',
  subject text,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_order)
);
CREATE INDEX idx_nurt_steps_seq ON public.lead_nurturing_steps(sequence_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_nurturing_steps TO authenticated;
GRANT ALL ON public.lead_nurturing_steps TO service_role;
ALTER TABLE public.lead_nurturing_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nurt_steps_admin_all" ON public.lead_nurturing_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas') OR public.has_role(auth.uid(),'marketing'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas') OR public.has_role(auth.uid(),'marketing'));
CREATE POLICY "nurt_steps_read_all" ON public.lead_nurturing_steps FOR SELECT TO authenticated USING (true);

-- ============ NURTURING ENROLLMENTS ============
CREATE TABLE public.lead_nurturing_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.lead_nurturing_sequences(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  next_run_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(lead_id, sequence_id)
);
CREATE INDEX idx_nurt_enroll_next ON public.lead_nurturing_enrollments(next_run_at) WHERE status='active';
CREATE INDEX idx_nurt_enroll_lead ON public.lead_nurturing_enrollments(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_nurturing_enrollments TO authenticated;
GRANT ALL ON public.lead_nurturing_enrollments TO service_role;
ALTER TABLE public.lead_nurturing_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nurt_enroll_admin_all" ON public.lead_nurturing_enrollments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas') OR public.has_role(auth.uid(),'marketing'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas') OR public.has_role(auth.uid(),'marketing'));
CREATE POLICY "nurt_enroll_read_all" ON public.lead_nurturing_enrollments FOR SELECT TO authenticated USING (true);

-- ============ SLA CHECK FUNCTION ============
CREATE OR REPLACE FUNCTION public.lead_sla_check_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_lead record;
  v_cfg record;
BEGIN
  FOR v_lead IN
    SELECT sl.id, sl.pipeline_stage_id, sl.closer_id, sl.created_at, sl.last_contact_at, sl.updated_at
    FROM public.stream_leads sl
    WHERE sl.pipeline_stage_id IS NOT NULL
      AND COALESCE(sl.is_archived,false) = false
    LIMIT 5000
  LOOP
    SELECT * INTO v_cfg FROM public.lead_sla_config
      WHERE pipeline_stage_id = v_lead.pipeline_stage_id AND is_active = true;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- First contact overdue
    IF v_lead.last_contact_at IS NULL
       AND v_lead.created_at < now() - (v_cfg.first_contact_minutes || ' minutes')::interval
       AND NOT EXISTS (
         SELECT 1 FROM public.lead_sla_violations v
         WHERE v.lead_id = v_lead.id AND v.violation_type='first_contact_overdue' AND v.resolved_at IS NULL
       )
    THEN
      INSERT INTO public.lead_sla_violations(lead_id, pipeline_stage_id, violation_type, severity, closer_id)
      VALUES (v_lead.id, v_lead.pipeline_stage_id, 'first_contact_overdue', 'high', v_lead.closer_id);
      v_inserted := v_inserted + 1;
    END IF;

    -- Stage stale
    IF v_lead.updated_at < now() - (v_cfg.max_days_in_stage || ' days')::interval
       AND NOT EXISTS (
         SELECT 1 FROM public.lead_sla_violations v
         WHERE v.lead_id = v_lead.id AND v.violation_type='stage_stale' AND v.resolved_at IS NULL
       )
    THEN
      INSERT INTO public.lead_sla_violations(lead_id, pipeline_stage_id, violation_type, severity, closer_id)
      VALUES (v_lead.id, v_lead.pipeline_stage_id, 'stage_stale', 'medium', v_lead.closer_id);
      v_inserted := v_inserted + 1;
    END IF;

    -- No follow up
    IF v_lead.last_contact_at IS NOT NULL
       AND v_lead.last_contact_at < now() - (v_cfg.follow_up_hours || ' hours')::interval
       AND NOT EXISTS (
         SELECT 1 FROM public.lead_sla_violations v
         WHERE v.lead_id = v_lead.id AND v.violation_type='no_followup' AND v.resolved_at IS NULL
       )
    THEN
      INSERT INTO public.lead_sla_violations(lead_id, pipeline_stage_id, violation_type, severity, closer_id)
      VALUES (v_lead.id, v_lead.pipeline_stage_id, 'no_followup', 'medium', v_lead.closer_id);
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted, 'ran_at', now());
END;
$$;

-- updated_at triggers
CREATE TRIGGER trg_sla_config_updated BEFORE UPDATE ON public.lead_sla_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_nurt_seq_updated BEFORE UPDATE ON public.lead_nurturing_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
