-- Categorías por portal para Academy
CREATE TABLE public.academy_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, name)
);

CREATE INDEX idx_academy_categories_portal ON public.academy_categories(portal_id, display_order);

ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;

-- Lectura pública (igual que cursos)
CREATE POLICY "Categories viewable by everyone"
  ON public.academy_categories FOR SELECT
  USING (true);

-- Solo portal admin puede modificar
CREATE POLICY "Portal admins manage categories insert"
  ON public.academy_categories FOR INSERT
  WITH CHECK (public.is_portal_admin(portal_id));

CREATE POLICY "Portal admins manage categories update"
  ON public.academy_categories FOR UPDATE
  USING (public.is_portal_admin(portal_id));

CREATE POLICY "Portal admins manage categories delete"
  ON public.academy_categories FOR DELETE
  USING (public.is_portal_admin(portal_id));

CREATE TRIGGER update_academy_categories_updated_at
  BEFORE UPDATE ON public.academy_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular cursos a categorías (nullable -> "General")
ALTER TABLE public.academy_courses
  ADD COLUMN category_id UUID REFERENCES public.academy_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_academy_courses_category ON public.academy_courses(category_id);