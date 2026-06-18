CREATE POLICY "Ops can insert sub_ibs" ON public.sub_ibs FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'operaciones'::app_role) OR has_role(auth.uid(), 'admin_operaciones'::app_role)
);