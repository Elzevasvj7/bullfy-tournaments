-- Academy — restricción por tier + membresías + paquetes (bundles)

ALTER TABLE public.academy_courses
  ADD COLUMN IF NOT EXISTS required_tiers TEXT[];

ALTER TABLE public.portal_products
  ADD COLUMN IF NOT EXISTS membership_tier TEXT;

CREATE TABLE IF NOT EXISTS public.academy_bundles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id      UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  thumbnail_path TEXT,
  price_usd      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft',
  product_id     UUID,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_bundles_portal ON public.academy_bundles(portal_id);

CREATE TABLE IF NOT EXISTS public.academy_bundle_courses (
  bundle_id  UUID NOT NULL REFERENCES public.academy_bundles(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_bundle_courses_bundle ON public.academy_bundle_courses(bundle_id);

GRANT SELECT ON public.academy_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_bundles TO authenticated;
GRANT ALL ON public.academy_bundles TO service_role;

GRANT SELECT ON public.academy_bundle_courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_bundle_courses TO authenticated;
GRANT ALL ON public.academy_bundle_courses TO service_role;

ALTER TABLE public.academy_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_bundle_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_bundles: anon read published"
  ON public.academy_bundles FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "academy_bundles: owner all"
  ON public.academy_bundles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = academy_bundles.portal_id AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = academy_bundles.portal_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "academy_bundle_courses: anon read"
  ON public.academy_bundle_courses FOR SELECT TO anon
  USING (true);

CREATE POLICY "academy_bundle_courses: owner all"
  ON public.academy_bundle_courses FOR ALL TO authenticated
  USING (
    bundle_id IN (
      SELECT b.id FROM public.academy_bundles b
      JOIN public.partner_portals pp ON pp.id = b.portal_id
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    bundle_id IN (
      SELECT b.id FROM public.academy_bundles b
      JOIN public.partner_portals pp ON pp.id = b.portal_id
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  );