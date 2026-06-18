
-- Fix storage upload policy for documents
DROP POLICY "Admins can upload document files" ON storage.objects;
CREATE POLICY "Admins can upload document files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role)));

-- Fix storage delete policy for documents
DROP POLICY "Admins can delete document files" ON storage.objects;
CREATE POLICY "Admins can delete document files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role)));

-- Fix storage upload policy for reports
DROP POLICY "Admins can upload reports" ON storage.objects;
CREATE POLICY "Admins can upload reports" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role)));
