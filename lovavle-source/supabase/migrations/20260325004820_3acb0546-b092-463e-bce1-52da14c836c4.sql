
-- Add parent_sub_ib_id for recursive hierarchy (SubIB1 -> SubIB2 -> SubIB3...)
ALTER TABLE public.sub_ibs ADD COLUMN parent_sub_ib_id uuid REFERENCES public.sub_ibs(id) ON DELETE SET NULL DEFAULT NULL;

-- Add sub_ib_id to profiles so IB Externo users know which sub_ib they are
ALTER TABLE public.profiles ADD COLUMN sub_ib_id uuid REFERENCES public.sub_ibs(id) ON DELETE SET NULL DEFAULT NULL;
