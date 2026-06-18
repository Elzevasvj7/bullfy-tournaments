ALTER TABLE public.sub_ibs 
  ADD COLUMN es_master_ib boolean NOT NULL DEFAULT false,
  ADD COLUMN master_ib_numero integer,
  ADD COLUMN dolares_por_lote numeric;