
CREATE TABLE IF NOT EXISTS public.sms_rate_limit_config (
  id int PRIMARY KEY DEFAULT 1,
  email_purpose_per_10min int NOT NULL DEFAULT 3,
  phone_per_10min int NOT NULL DEFAULT 2,
  phone_per_24h int NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO public.sms_rate_limit_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.sms_rate_limit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_admin_read_sms_config" ON public.sms_rate_limit_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin'::app_role));

ALTER TABLE public.sms_phone_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_admin_read_blocklist" ON public.sms_phone_blocklist
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin'::app_role));
