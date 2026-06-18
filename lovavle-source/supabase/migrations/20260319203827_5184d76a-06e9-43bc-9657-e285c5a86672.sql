
-- Fix admin policy to include explicit WITH CHECK for INSERT operations
DROP POLICY IF EXISTS "Admins can manage sub IBs" ON public.sub_ibs;
CREATE POLICY "Admins can manage sub IBs" ON public.sub_ibs
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
