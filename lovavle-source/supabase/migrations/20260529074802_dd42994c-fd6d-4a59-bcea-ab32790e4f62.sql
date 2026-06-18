ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'video';

CREATE TABLE IF NOT EXISTS public.academy_lesson_attachments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id      UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  file_type      TEXT,
  size_bytes     BIGINT,
  is_primary     BOOLEAN NOT NULL DEFAULT false,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_lesson_attachments_lesson
  ON public.academy_lesson_attachments(lesson_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-attachments', 'academy-attachments', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.academy_lesson_attachments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.academy_lesson_attachments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_lesson_attachments TO authenticated;
GRANT ALL ON public.academy_lesson_attachments TO service_role;

CREATE POLICY "academy_lesson_attachments: anon read"
  ON public.academy_lesson_attachments FOR SELECT TO anon
  USING (true);

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