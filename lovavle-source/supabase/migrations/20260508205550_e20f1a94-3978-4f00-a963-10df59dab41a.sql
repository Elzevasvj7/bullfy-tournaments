CREATE UNIQUE INDEX IF NOT EXISTS sub_ibs_unique_ib_correo
  ON public.sub_ibs (ib_id, lower(trim(correo)))
  WHERE correo IS NOT NULL;