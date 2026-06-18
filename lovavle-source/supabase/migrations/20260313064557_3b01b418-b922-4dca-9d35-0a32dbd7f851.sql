-- Allow operaciones and admin_operaciones to update ibs status (for syncing from ops_queue)
CREATE POLICY "Ops can update IB status"
  ON public.ibs
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'operaciones'::app_role) 
    OR has_role(auth.uid(), 'admin_operaciones'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'operaciones'::app_role) 
    OR has_role(auth.uid(), 'admin_operaciones'::app_role)
  );