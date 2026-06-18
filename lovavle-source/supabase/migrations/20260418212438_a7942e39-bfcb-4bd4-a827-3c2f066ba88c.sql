-- 1) Toggle por portal
ALTER TABLE public.partner_portals
ADD COLUMN IF NOT EXISTS recording_to_class_enabled boolean NOT NULL DEFAULT false;

-- 2) Vínculo entre grabación y lección de academy (idempotencia)
ALTER TABLE public.live_recordings
ADD COLUMN IF NOT EXISTS academy_lesson_id uuid NULL REFERENCES public.academy_lessons(id) ON DELETE SET NULL;

-- 3) Bucket privado para videos de academy
INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-videos', 'academy-videos', false)
ON CONFLICT (id) DO NOTHING;

-- 4) RLS para academy-videos
-- Dueños del portal y admins pueden subir/leer/eliminar
DROP POLICY IF EXISTS "Admins and portal owners can read academy-videos" ON storage.objects;
CREATE POLICY "Admins and portal owners can read academy-videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'academy-videos' AND (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id::text = (storage.foldername(name))[1]
        AND i.created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Admins and portal owners can upload academy-videos" ON storage.objects;
CREATE POLICY "Admins and portal owners can upload academy-videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'academy-videos' AND (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id::text = (storage.foldername(name))[1]
        AND i.created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Admins and portal owners can delete academy-videos" ON storage.objects;
CREATE POLICY "Admins and portal owners can delete academy-videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'academy-videos' AND (
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id::text = (storage.foldername(name))[1]
        AND i.created_by = auth.uid()
    )
  )
);