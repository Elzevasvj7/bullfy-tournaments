CREATE POLICY "Ops can insert reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'operaciones'::app_role) OR
  has_role(auth.uid(), 'admin_operaciones'::app_role)
);