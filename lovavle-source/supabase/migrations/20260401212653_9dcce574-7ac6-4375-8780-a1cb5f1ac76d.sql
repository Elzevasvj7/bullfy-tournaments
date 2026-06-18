
CREATE TABLE public.partner_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (anon) to insert and read tokens
CREATE POLICY "Allow anon insert tokens"
ON public.partner_password_reset_tokens FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon select tokens"
ON public.partner_password_reset_tokens FOR SELECT TO anon
USING (true);

CREATE POLICY "Allow anon update tokens"
ON public.partner_password_reset_tokens FOR UPDATE TO anon
USING (true);

-- Portal owners can view tokens for their portal
CREATE POLICY "Portal owner can view tokens"
ON public.partner_password_reset_tokens FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partner_portals pp
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE pp.id = partner_password_reset_tokens.portal_id
    AND p.id = auth.uid()
  )
);
