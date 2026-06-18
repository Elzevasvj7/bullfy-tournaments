-- ─── WhatsApp Templates (pre-approved by Meta) ───
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'es',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  body TEXT NOT NULL,
  variables_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved',
  twilio_content_sid TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active templates"
ON public.whatsapp_templates FOR SELECT
TO authenticated
USING (active = true);

CREATE POLICY "Admins can manage templates"
ON public.whatsapp_templates FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'admin_ventas') OR
  public.has_role(auth.uid(), 'marketing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'global_admin') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'admin_ventas') OR
  public.has_role(auth.uid(), 'marketing')
);

CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── WhatsApp Messages (chat history per lead) ───
CREATE TABLE public.lead_whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  agent_id UUID,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  to_phone TEXT,
  from_phone TEXT,
  body TEXT,
  media_url TEXT,
  media_content_type TEXT,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  template_variables JSONB,
  twilio_message_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_whatsapp_messages_lead_id ON public.lead_whatsapp_messages(lead_id, created_at DESC);
CREATE INDEX idx_lead_whatsapp_messages_sid ON public.lead_whatsapp_messages(twilio_message_sid);

ALTER TABLE public.lead_whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users with lead access can view messages"
ON public.lead_whatsapp_messages FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'admin_ventas') OR
  public.has_role(auth.uid(), 'ventas') OR
  public.has_role(auth.uid(), 'bd') OR
  public.has_role(auth.uid(), 'marketing')
);

CREATE POLICY "Service role can insert messages"
ON public.lead_whatsapp_messages FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'global_admin') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'admin_ventas') OR
  public.has_role(auth.uid(), 'ventas') OR
  public.has_role(auth.uid(), 'bd')
);

CREATE POLICY "Admins can update messages"
ON public.lead_whatsapp_messages FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'admin_ventas')
);

CREATE TRIGGER update_lead_whatsapp_messages_updated_at
BEFORE UPDATE ON public.lead_whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live chat
ALTER TABLE public.lead_whatsapp_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_whatsapp_messages;

-- ─── WhatsApp config row in integration_settings ───
INSERT INTO public.integration_settings (service_name, enabled, config)
VALUES (
  'whatsapp_business',
  false,
  jsonb_build_object(
    'sender_number', '',
    'sandbox_mode', true,
    'webhook_url', 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/whatsapp-webhook-receive'
  )
)
ON CONFLICT (service_name) DO NOTHING;