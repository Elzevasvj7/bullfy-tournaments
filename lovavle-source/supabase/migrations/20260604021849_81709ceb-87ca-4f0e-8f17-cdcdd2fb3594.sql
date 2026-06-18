ALTER TABLE public.partner_portals
  ADD COLUMN IF NOT EXISTS email_from_name    text,
  ADD COLUMN IF NOT EXISTS email_from_address text;

COMMENT ON COLUMN public.partner_portals.email_from_address IS
  'Remitente propio del portal (ej. noreply@clubfinanciero.pro). Setear SOLO con el dominio verificado en Resend. Vacío = marca Bullfy por defecto.';
COMMENT ON COLUMN public.partner_portals.email_from_name IS
  'Nombre visible del remitente (ej. "Club Financiero"). Si vacío, usa display_name.';