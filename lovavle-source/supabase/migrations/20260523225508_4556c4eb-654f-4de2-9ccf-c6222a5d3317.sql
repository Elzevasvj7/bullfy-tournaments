
ALTER TABLE public.ib_external_requests
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ib-request-attachments',
  'ib-request-attachments',
  false,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','video/mp4','video/quicktime','video/webm','video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Owner can upload to their own folder {auth.uid}/...
CREATE POLICY "ib_req_attach_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ib-request-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owner can view their files
CREATE POLICY "ib_req_attach_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ib-request-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owner can delete their files
CREATE POLICY "ib_req_attach_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ib-request-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Staff (ops, bd, admin, global_admin) can view all attachments
CREATE POLICY "ib_req_attach_staff_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ib-request-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'global_admin'::app_role)
    OR public.has_role(auth.uid(), 'operaciones'::app_role)
    OR public.has_role(auth.uid(), 'admin_operaciones'::app_role)
    OR public.has_role(auth.uid(), 'bd'::app_role)
    OR public.has_role(auth.uid(), 'admin_bd'::app_role)
  )
);

-- Admins can delete any attachment
CREATE POLICY "ib_req_attach_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ib-request-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'global_admin'::app_role)
  )
);
