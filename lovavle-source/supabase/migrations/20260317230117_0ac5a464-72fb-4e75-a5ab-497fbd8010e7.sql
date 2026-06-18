-- Allow global_admin to delete objections and scripts
CREATE POLICY "Global admins can delete objections"
ON public.bce_objections
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'global_admin'::app_role));

CREATE POLICY "Global admins can delete scripts"
ON public.bce_scripts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'global_admin'::app_role));
