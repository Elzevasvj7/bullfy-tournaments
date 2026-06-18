
-- accounting-invoices
CREATE POLICY "inv_obj_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'accounting-invoices' AND (
  (auth.uid()::text = (storage.foldername(name))[1])
  OR public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'global_admin'::app_role)
  OR public.has_role(auth.uid(),'accountant'::app_role)
  OR public.has_role(auth.uid(),'directivo'::app_role)
));
CREATE POLICY "inv_obj_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'accounting-invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "inv_obj_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'accounting-invoices' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'global_admin'::app_role)
  OR public.has_role(auth.uid(),'accountant'::app_role)
));

-- accounting-treasury-proofs
CREATE POLICY "tp_obj_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'accounting-treasury-proofs' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'global_admin'::app_role)
  OR public.has_role(auth.uid(),'accountant'::app_role)
  OR public.has_role(auth.uid(),'treasurer'::app_role)
  OR public.has_role(auth.uid(),'directivo'::app_role)
));
CREATE POLICY "tp_obj_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'accounting-treasury-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tp_obj_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'accounting-treasury-proofs' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'global_admin'::app_role)
  OR public.has_role(auth.uid(),'accountant'::app_role)
));
