ALTER TABLE public.ibs ADD COLUMN tiene_comision_por_lote boolean DEFAULT false;
ALTER TABLE public.ibs ADD COLUMN comision_dolares_por_lote numeric DEFAULT NULL;