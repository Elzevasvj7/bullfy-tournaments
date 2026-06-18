-- =============================================================================
-- Referido simple (NO MLM) para usuarios de portal
-- =============================================================================
-- Cualquier usuario registrado en un partner portal puede compartir un link de
-- referido. Cuando alguien se registra con ese link, queda guardado QUIÉN lo
-- refirió en `partner_users.referred_by`. Esto es independiente del sistema MLM
-- (portal_mlm_referrals / comisiones): es solo trazabilidad "de parte de quién
-- viene" para que el IB la vea y, a futuro, diseñe campañas por cantidad de
-- referidos.
--
-- Diseño:
--   - referred_by → self-FK a partner_users(id). ON DELETE SET NULL para no
--     romper el registro del referido si el referidor es eliminado.
--   - referred_at → momento del registro vía referido (auditoría/campañas).
--   - Índice (portal_id, referred_by) para los conteos por referidor del panel.
-- =============================================================================

ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS referred_by uuid
    REFERENCES public.partner_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz;

-- El IB consulta "¿a quién refirió X?" y el conteo de referidos por usuario.
CREATE INDEX IF NOT EXISTS idx_partner_users_referred_by
  ON public.partner_users (portal_id, referred_by);

COMMENT ON COLUMN public.partner_users.referred_by IS
  'Usuario del mismo portal que refirió a este (referido simple, NO MLM). NULL si registro directo.';
COMMENT ON COLUMN public.partner_users.referred_at IS
  'Momento del registro cuando llegó vía link de referido.';
