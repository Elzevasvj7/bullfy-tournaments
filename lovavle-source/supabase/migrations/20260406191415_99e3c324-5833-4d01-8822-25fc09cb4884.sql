ALTER TABLE public.live_saved_ctas
ADD COLUMN display_mode text NOT NULL DEFAULT 'default';

COMMENT ON COLUMN public.live_saved_ctas.display_mode IS 'default = banner normal, banner_strip = cintillo superior horizontal';