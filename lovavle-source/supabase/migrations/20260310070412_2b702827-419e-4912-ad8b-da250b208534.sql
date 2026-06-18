-- Remove unnecessary anon SELECT policies on ref tables
-- These tables are only used behind authentication, anon access is not needed
DROP POLICY IF EXISTS "Anyone can read CPA LATAM" ON public.ref_cpa_latam;
DROP POLICY IF EXISTS "Anyone can read CPA Hibrido" ON public.ref_cpa_hibrido;
DROP POLICY IF EXISTS "Anyone can read PropFirm comisiones" ON public.ref_propfirm_comisiones;
DROP POLICY IF EXISTS "Anyone can read PropFirm cuentas" ON public.ref_propfirm_cuentas;
DROP POLICY IF EXISTS "Anyone can read spreads" ON public.ref_spreads;