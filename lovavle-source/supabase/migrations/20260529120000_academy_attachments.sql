-- ============================================================================
-- Academy — lecciones de tipo documento + recursos adjuntos
-- ============================================================================
-- Permite que un módulo tenga, además de lecciones de video (Mux), lecciones
-- cuyo contenido principal es un documento, y que cualquier lección lleve
-- archivos adjuntos descargables (PDF, Word, Excel, ZIP, etc.).
--
-- Los archivos viven en un bucket PRIVADO (academy-attachments). El acceso se
-- entrega vía signed URL desde la edge function academy-file-url, que valida
-- inscripción + tier (igual que academy-mux-signed-token para video).
-- ============================================================================

-- 1. Tipo de lección: 'video' (default, comportamiento actual) | 'document'
ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'video';

-- 2. Tabla de adjuntos / recursos de una lección
CREATE TABLE IF NOT EXISTS public.academy_lesson_attachments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id      UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,                 -- nombre visible para el usuario
  file_path      TEXT NOT NULL,                 -- path en bucket academy-attachments
  file_type      TEXT,                          -- mime type
  size_bytes     BIGINT,
  is_primary     BOOLEAN NOT NULL DEFAULT false, -- true = documento principal de una lección 'document'
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_lesson_attachments_lesson
  ON public.academy_lesson_attachments(lesson_id);

-- 3. Bucket PRIVADO para los archivos (no público: el acceso se sirve firmado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-attachments', 'academy-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS de la tabla de adjuntos
ALTER TABLE public.academy_lesson_attachments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.academy_lesson_attachments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_lesson_attachments TO authenticated;
GRANT ALL ON public.academy_lesson_attachments TO service_role;

-- Anon (usuarios del portal) puede leer la metadata de adjuntos (el archivo en
-- sí se sirve firmado por la EF; aquí solo se listan nombres/orden). El gate de
-- inscripción/tier real se aplica al pedir el signed URL.
CREATE POLICY "academy_lesson_attachments: anon read"
  ON public.academy_lesson_attachments FOR SELECT TO anon
  USING (true);

-- IB admin del portal gestiona los adjuntos de sus cursos.
-- Cadena: attachment → lesson → module → course → portal → profiles(auth.uid())
CREATE POLICY "academy_lesson_attachments: owner all"
  ON public.academy_lesson_attachments FOR ALL TO authenticated
  USING (
    lesson_id IN (
      SELECT l.id
      FROM public.academy_lessons l
      JOIN public.academy_modules m  ON m.id = l.module_id
      JOIN public.academy_courses c  ON c.id = m.course_id
      JOIN public.partner_portals pp ON pp.id = c.portal_id
      JOIN public.profiles p         ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    lesson_id IN (
      SELECT l.id
      FROM public.academy_lessons l
      JOIN public.academy_modules m  ON m.id = l.module_id
      JOIN public.academy_courses c  ON c.id = m.course_id
      JOIN public.partner_portals pp ON pp.id = c.portal_id
      JOIN public.profiles p         ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  );

-- 5. Storage policies para que el IB admin suba/borre archivos del bucket.
--    (La lectura de los archivos por usuarios se hace SIEMPRE vía signed URL
--     generado con service_role en la EF academy-file-url; por eso no se
--     agrega policy de SELECT a anon sobre storage.objects.)
CREATE POLICY "academy-attachments: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academy-attachments');

CREATE POLICY "academy-attachments: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'academy-attachments')
  WITH CHECK (bucket_id = 'academy-attachments');

CREATE POLICY "academy-attachments: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'academy-attachments');
