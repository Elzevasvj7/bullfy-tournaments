
CREATE TABLE public.lead_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  owner_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_webhooks TO authenticated;
GRANT ALL ON public.lead_webhooks TO service_role;
ALTER TABLE public.lead_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lw_admin_all" ON public.lead_webhooks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'));

CREATE TABLE public.lead_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.lead_webhooks(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.stream_leads(id) ON DELETE SET NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  response_status int,
  response_body text,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lwd_pending ON public.lead_webhook_deliveries(next_attempt_at) WHERE status='pending';
CREATE INDEX idx_lwd_webhook ON public.lead_webhook_deliveries(webhook_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_webhook_deliveries TO authenticated;
GRANT ALL ON public.lead_webhook_deliveries TO service_role;
ALTER TABLE public.lead_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lwd_admin_all" ON public.lead_webhook_deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'));

CREATE OR REPLACE FUNCTION public.lead_webhook_enqueue(p_event text, p_lead_id uuid, p_payload jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.lead_webhook_deliveries(webhook_id, lead_id, event, payload)
  SELECT w.id, p_lead_id, p_event, p_payload
  FROM public.lead_webhooks w
  WHERE w.is_active = true AND p_event = ANY(w.events);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_stream_leads_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_is_won boolean;
  v_is_closed boolean;
  v_old_won boolean;
  v_old_closed boolean;
BEGIN
  v_payload := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.lead_webhook_enqueue('lead.created', NEW.id, v_payload);
    RETURN NEW;
  END IF;

  IF NEW.pipeline_stage_id IS DISTINCT FROM OLD.pipeline_stage_id THEN
    PERFORM public.lead_webhook_enqueue('lead.stage_changed', NEW.id,
      jsonb_build_object('lead', v_payload, 'old_stage_id', OLD.pipeline_stage_id, 'new_stage_id', NEW.pipeline_stage_id));

    SELECT is_won, is_closed INTO v_is_won, v_is_closed FROM public.lead_pipeline_stages WHERE id = NEW.pipeline_stage_id;
    SELECT is_won, is_closed INTO v_old_won, v_old_closed FROM public.lead_pipeline_stages WHERE id = OLD.pipeline_stage_id;
    IF COALESCE(v_is_won,false) AND NOT COALESCE(v_old_won,false) THEN
      PERFORM public.lead_webhook_enqueue('lead.won', NEW.id, v_payload);
    ELSIF COALESCE(v_is_closed,false) AND NOT COALESCE(v_is_won,false) AND NOT COALESCE(v_old_closed,false) THEN
      PERFORM public.lead_webhook_enqueue('lead.lost', NEW.id, v_payload);
    END IF;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM public.lead_webhook_enqueue('lead.assigned', NEW.id,
      jsonb_build_object('lead', v_payload, 'old_assigned_to', OLD.assigned_to, 'new_assigned_to', NEW.assigned_to));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stream_leads_webhook_ins ON public.stream_leads;
CREATE TRIGGER trg_stream_leads_webhook_ins
  AFTER INSERT ON public.stream_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_stream_leads_webhook();

DROP TRIGGER IF EXISTS trg_stream_leads_webhook_upd ON public.stream_leads;
CREATE TRIGGER trg_stream_leads_webhook_upd
  AFTER UPDATE ON public.stream_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_stream_leads_webhook();

CREATE TRIGGER trg_lead_webhooks_updated BEFORE UPDATE ON public.lead_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
