
-- Replace the permissive insert policy with a restrictive one
-- Only the audit_trigger_func (SECURITY DEFINER) actually inserts, 
-- so we deny direct user inserts
DROP POLICY "System can insert audit logs" ON public.audit_log;

CREATE POLICY "No direct inserts to audit logs"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (false);
