-- =============================================================================
-- Remitente de email configurable por portal (white-label de correos)
-- =============================================================================
-- Permite que los correos a los usuarios de un portal salgan desde el dominio
-- propio del IB (ej. noreply@clubfinanciero.pro) en vez del de Bullfy.
--
-- Reglas:
--   - email_from_address VACÍO  → el portal usa el remitente y la marca Bullfy
--     por defecto (comportamiento actual; ningún portal cambia hasta configurarlo).
--   - email_from_address SETEADO → ese portal queda "white-label de email": los
--     correos salen desde esa dirección y con su nombre, sin marca Bullfy.
--
-- IMPORTANTE: solo setear email_from_address cuando el dominio esté VERIFICADO
-- en Resend (registros DNS). Si se setea sin verificar, Resend rechaza el envío.
-- =============================================================================

ALTER TABLE public.partner_portals
  ADD COLUMN IF NOT EXISTS email_from_name    text,
  ADD COLUMN IF NOT EXISTS email_from_address text;

COMMENT ON COLUMN public.partner_portals.email_from_address IS
  'Remitente propio del portal (ej. noreply@clubfinanciero.pro). Setear SOLO con el dominio verificado en Resend. Vacío = marca Bullfy por defecto.';
COMMENT ON COLUMN public.partner_portals.email_from_name IS
  'Nombre visible del remitente (ej. "Club Financiero"). Si vacío, usa display_name.';
