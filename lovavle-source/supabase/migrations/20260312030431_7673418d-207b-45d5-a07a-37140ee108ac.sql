-- Fix RLS on ibs: allow global_admin to manage IBs
DROP POLICY IF EXISTS "Admins can manage IBs" ON public.ibs;
CREATE POLICY "Admins can manage IBs" ON public.ibs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

-- Fix RLS on config tables: allow global_admin
DROP POLICY IF EXISTS "Admins can manage spread config" ON public.ib_spread_config;
CREATE POLICY "Admins can manage spread config" ON public.ib_spread_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage CPA config" ON public.ib_cpa_config;
CREATE POLICY "Admins can manage CPA config" ON public.ib_cpa_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage hybrid config" ON public.ib_hybrid_config;
CREATE POLICY "Admins can manage hybrid config" ON public.ib_hybrid_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage propfirm config" ON public.ib_propfirm_config;
CREATE POLICY "Admins can manage propfirm config" ON public.ib_propfirm_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage CPA distribution" ON public.ib_cpa_distribution;
CREATE POLICY "Admins can manage CPA distribution" ON public.ib_cpa_distribution
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage sub IBs" ON public.sub_ibs;
CREATE POLICY "Admins can manage sub IBs" ON public.sub_ibs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

-- Also fix reports insert policy for global_admin
DROP POLICY IF EXISTS "Admins can create reports" ON public.reports;
CREATE POLICY "Admins can create reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));