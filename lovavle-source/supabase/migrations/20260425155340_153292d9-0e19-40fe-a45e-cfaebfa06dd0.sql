-- Fix RLS policy on portal_mlm_config: add WITH CHECK so INSERT/UPDATE work
DROP POLICY IF EXISTS "Portal owners manage own MLM config" ON public.portal_mlm_config;

CREATE POLICY "Portal owners manage own MLM config"
ON public.portal_mlm_config
FOR ALL
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.partner_portals pp
    JOIN public.ibs i ON i.id = pp.ib_id
    WHERE pp.id = portal_mlm_config.portal_id AND i.created_by = auth.uid()
  )) OR public.has_role(auth.uid(), 'global_admin'::app_role)
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.partner_portals pp
    JOIN public.ibs i ON i.id = pp.ib_id
    WHERE pp.id = portal_mlm_config.portal_id AND i.created_by = auth.uid()
  )) OR public.has_role(auth.uid(), 'global_admin'::app_role)
);