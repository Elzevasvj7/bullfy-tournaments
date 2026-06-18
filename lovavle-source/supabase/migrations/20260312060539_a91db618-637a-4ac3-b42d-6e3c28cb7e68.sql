
ALTER TABLE public.ibs ADD COLUMN IF NOT EXISTS negociaciones_especiales text;
ALTER TABLE public.ibs ADD COLUMN IF NOT EXISTS contacto_corporativo text;
ALTER TABLE public.ibs ADD COLUMN IF NOT EXISTS representante_legal text;
ALTER TABLE public.ibs ADD COLUMN IF NOT EXISTS tipo_id_representante text;
ALTER TABLE public.ibs ADD COLUMN IF NOT EXISTS id_representante text;
