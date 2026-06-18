
-- 1. Storage bucket público para archivos descargables (100 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-cta-files',
  'live-cta-files',
  true,
  104857600,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv',
    'application/zip','application/x-rar-compressed','application/x-7z-compressed',
    'video/mp4','video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: público para leer, owner para escribir
CREATE POLICY "live_cta_files_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'live-cta-files');

CREATE POLICY "live_cta_files_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'live-cta-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "live_cta_files_owner_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'live-cta-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "live_cta_files_owner_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'live-cta-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Biblioteca de archivos CTA por host
CREATE TABLE public.host_cta_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  button_text text NOT NULL DEFAULT 'Descargar',
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_cta_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_cta_files_owner_all"
ON public.host_cta_files FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "host_cta_files_admin_read"
ON public.host_cta_files FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE INDEX idx_host_cta_files_user ON public.host_cta_files(user_id);

CREATE TRIGGER trg_host_cta_files_updated_at
BEFORE UPDATE ON public.host_cta_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tracking de descargas (anónimo o identificado)
CREATE TABLE public.cta_file_downloads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cta_file_id uuid NOT NULL REFERENCES public.host_cta_files(id) ON DELETE CASCADE,
  room_id uuid,
  host_id uuid,
  viewer_id uuid,
  viewer_email text,
  viewer_name text,
  user_agent text,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cta_file_downloads ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar una descarga (incluso anónimos viendo el stream)
CREATE POLICY "cta_file_downloads_public_insert"
ON public.cta_file_downloads FOR INSERT
WITH CHECK (true);

-- El host (dueño del archivo) puede ver sus descargas
CREATE POLICY "cta_file_downloads_owner_read"
ON public.cta_file_downloads FOR SELECT
USING (
  auth.uid() = host_id
  OR EXISTS (
    SELECT 1 FROM public.host_cta_files f
    WHERE f.id = cta_file_id AND f.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'global_admin')
);

CREATE INDEX idx_cta_downloads_file ON public.cta_file_downloads(cta_file_id);
CREATE INDEX idx_cta_downloads_room ON public.cta_file_downloads(room_id);
CREATE INDEX idx_cta_downloads_host ON public.cta_file_downloads(host_id);
