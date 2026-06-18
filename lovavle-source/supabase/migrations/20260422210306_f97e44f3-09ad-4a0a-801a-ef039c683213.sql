ALTER TABLE public.ref_spreads
ADD COLUMN IF NOT EXISTS ajuste_manual numeric NOT NULL DEFAULT 0;