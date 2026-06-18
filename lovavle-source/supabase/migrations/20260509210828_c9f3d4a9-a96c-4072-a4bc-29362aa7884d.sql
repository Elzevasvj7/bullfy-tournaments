ALTER TABLE public.partner_portal_branding ADD COLUMN IF NOT EXISTS card_color TEXT;

UPDATE public.partner_portal_branding
SET primary_color = '#FFC107',
    card_color = '#477e30',
    login_bg_color = '#000000'
WHERE portal_id = (SELECT id FROM public.partner_portals WHERE nombre_portal = 'club-financiero');