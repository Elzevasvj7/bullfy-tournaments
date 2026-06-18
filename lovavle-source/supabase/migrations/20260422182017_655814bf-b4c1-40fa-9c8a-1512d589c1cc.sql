DROP POLICY IF EXISTS "Admins can manage CPA" ON public.ref_cpa_latam;
CREATE POLICY "Admins can manage CPA" ON public.ref_cpa_latam
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
);

DROP POLICY IF EXISTS "Admins can manage hybrid CPA" ON public.ref_cpa_hibrido;
CREATE POLICY "Admins can manage hybrid CPA" ON public.ref_cpa_hibrido
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
);