
DROP POLICY "Admins can manage documents" ON public.documents;
CREATE POLICY "Admins can manage documents" ON public.documents
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
