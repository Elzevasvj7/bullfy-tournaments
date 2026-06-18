
-- Replace the permissive INSERT policy with a restricted one
-- Only admins/global_admins can insert directly; triggers use SECURITY DEFINER
DROP POLICY "System can insert notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'global_admin'::app_role)
  );
