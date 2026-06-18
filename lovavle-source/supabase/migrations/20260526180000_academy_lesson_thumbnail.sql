-- ============================================================================
-- PR Mux #4.1 — Thumbnail por lección
-- ============================================================================
-- Hasta ahora solo el curso tenía portada (academy_courses.thumbnail_path).
-- Las lecciones no, así que la lista de lecciones tanto en admin como en
-- cliente se renderizaba solo con título + duración. UX pobre para sets de
-- 10+ lecciones donde el alumno necesita identificar visualmente qué clase
-- es cuál.
--
-- Esta migración agrega thumbnail_path a academy_lessons. El bucket de
-- storage (academy-thumbnails) se reusa — ya existe con las policies
-- correctas, no requiere migración adicional. Los paths usados son
-- <portal_id>/<timestamp>_<filename> al igual que las portadas de cursos.
-- ============================================================================

ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS thumbnail_path text;
