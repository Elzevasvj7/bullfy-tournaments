ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS is_host BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_partner_users_portal_is_host
  ON public.partner_users (portal_id, is_host);