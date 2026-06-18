
DROP POLICY IF EXISTS "Portal owner can manage branding" ON public.partner_portal_branding;

CREATE POLICY "Portal owner can manage branding" ON public.partner_portal_branding
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM partner_portals pp
    WHERE pp.id = partner_portal_branding.portal_id
    AND (
      -- BD who created the IB
      EXISTS (SELECT 1 FROM ibs i WHERE i.id = pp.ib_id AND i.created_by = auth.uid())
      -- OR user whose profile.ib_id matches the portal's ib_id
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.ib_id = pp.ib_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_portals pp
    WHERE pp.id = partner_portal_branding.portal_id
    AND (
      EXISTS (SELECT 1 FROM ibs i WHERE i.id = pp.ib_id AND i.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.ib_id = pp.ib_id)
    )
  )
);
