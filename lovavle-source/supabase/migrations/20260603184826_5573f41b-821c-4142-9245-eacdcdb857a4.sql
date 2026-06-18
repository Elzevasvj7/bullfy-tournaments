ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS referred_by uuid
    REFERENCES public.partner_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_partner_users_referred_by
  ON public.partner_users (portal_id, referred_by);

COMMENT ON COLUMN public.partner_users.referred_by IS
  'Usuario del mismo portal que refirió a este (referido simple, NO MLM). NULL si registro directo.';
COMMENT ON COLUMN public.partner_users.referred_at IS
  'Momento del registro cuando llegó vía link de referido.';