
DROP POLICY "Portal admins can read own portal leads" ON public.stream_leads;

CREATE POLICY "Portal admins can read own portal leads"
ON public.stream_leads FOR SELECT
TO authenticated
USING (
  partner_portal_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM partner_portals pp
    JOIN profiles pr ON pr.ib_id = pp.ib_id
    WHERE pp.id = stream_leads.partner_portal_id
    AND pr.id = auth.uid()
  )
);
