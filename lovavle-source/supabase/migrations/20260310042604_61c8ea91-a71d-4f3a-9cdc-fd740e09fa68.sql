
-- Allow anonymous read access to reference tables (for onboarding form without login)
CREATE POLICY "Anyone can read spreads" ON public.ref_spreads FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can read CPA LATAM" ON public.ref_cpa_latam FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can read CPA Hibrido" ON public.ref_cpa_hibrido FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can read PropFirm comisiones" ON public.ref_propfirm_comisiones FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can read PropFirm cuentas" ON public.ref_propfirm_cuentas FOR SELECT TO anon USING (true);
