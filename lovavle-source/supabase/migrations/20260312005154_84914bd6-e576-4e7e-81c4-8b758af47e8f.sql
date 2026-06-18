
-- Add discount code fields to ibs table for PropFirm
ALTER TABLE public.ibs ADD COLUMN tiene_codigo_descuento boolean DEFAULT false;
ALTER TABLE public.ibs ADD COLUMN codigo_descuento text DEFAULT NULL;
ALTER TABLE public.ibs ADD COLUMN porcentaje_descuento numeric DEFAULT NULL;
