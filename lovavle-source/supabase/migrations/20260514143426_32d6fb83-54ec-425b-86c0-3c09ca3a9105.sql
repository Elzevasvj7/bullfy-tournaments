
CREATE TABLE public.sms_phone_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_by TEXT
);
ALTER TABLE public.sms_phone_blocklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.sms_phone_blocklist FOR ALL USING (false);
CREATE INDEX idx_sms_phone_blocklist_phone ON public.sms_phone_blocklist(phone);
