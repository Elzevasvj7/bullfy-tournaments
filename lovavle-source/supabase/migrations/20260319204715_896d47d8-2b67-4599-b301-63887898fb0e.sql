-- Allow admin_bd to insert reports (same as BDs but for any IB)
CREATE POLICY "Admin BD can insert reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin_bd'::app_role));