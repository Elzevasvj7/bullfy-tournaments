
-- Drop the old policy
DROP POLICY "Portal admins can manage their users" ON public.partner_users;

-- Create new policy: IB owner (via profiles.ib_id) is the portal admin
CREATE POLICY "Portal admins can manage their users"
ON public.partner_users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_portals pp
    JOIN profiles pr ON pr.ib_id = pp.ib_id
    WHERE pp.id = partner_users.portal_id
    AND pr.id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'global_admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_portals pp
    JOIN profiles pr ON pr.ib_id = pp.ib_id
    WHERE pp.id = partner_users.portal_id
    AND pr.id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'global_admin'::app_role)
);
