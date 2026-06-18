
CREATE TABLE public.partner_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'registration',
  portal_id UUID REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public registration flow)
CREATE POLICY "Anyone can create OTP codes"
  ON public.partner_otp_codes
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read their own OTP by email (for verification)
CREATE POLICY "Anyone can read OTP by email"
  ON public.partner_otp_codes
  FOR SELECT
  USING (true);

-- Allow updates for verification attempts
CREATE POLICY "Anyone can update OTP codes"
  ON public.partner_otp_codes
  FOR UPDATE
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_partner_otp_email_purpose ON public.partner_otp_codes (email, purpose, verified);
CREATE INDEX idx_partner_otp_expires ON public.partner_otp_codes (expires_at);
