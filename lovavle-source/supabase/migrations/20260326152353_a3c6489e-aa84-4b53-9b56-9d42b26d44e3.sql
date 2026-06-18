-- Allow admins and admin_operaciones to insert audit logs for $/lote changes
CREATE POLICY "Admins can insert audit logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'global_admin'::app_role) 
  OR has_role(auth.uid(), 'admin_operaciones'::app_role)
);

-- Drop the old blocking policy
DROP POLICY IF EXISTS "No direct inserts to audit logs" ON public.audit_log;