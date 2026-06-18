CREATE TABLE IF NOT EXISTS public.portal_classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  timezone        TEXT NOT NULL DEFAULT 'America/Bogota',
  location_type   TEXT NOT NULL DEFAULT 'online',
  location_url    TEXT,
  required_tiers  TEXT[],
  capacity        INTEGER,
  status          TEXT NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_classes_portal   ON public.portal_classes(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_classes_starts   ON public.portal_classes(starts_at);
CREATE INDEX IF NOT EXISTS idx_portal_classes_status   ON public.portal_classes(status);

CREATE TABLE IF NOT EXISTS public.portal_class_registrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id         UUID NOT NULL REFERENCES public.portal_classes(id) ON DELETE CASCADE,
  partner_user_id  UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, partner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_class_reg_class ON public.portal_class_registrations(class_id);
CREATE INDEX IF NOT EXISTS idx_portal_class_reg_user  ON public.portal_class_registrations(partner_user_id);

GRANT SELECT ON public.portal_classes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_classes TO authenticated;
GRANT ALL ON public.portal_classes TO service_role;

GRANT SELECT, INSERT, DELETE ON public.portal_class_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_class_registrations TO authenticated;
GRANT ALL ON public.portal_class_registrations TO service_role;

ALTER TABLE public.portal_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_class_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_classes: anon read published"
  ON public.portal_classes FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "portal_classes: owner all"
  ON public.portal_classes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_classes.portal_id AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_classes.portal_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "portal_class_registrations: anon read"
  ON public.portal_class_registrations FOR SELECT TO anon
  USING (true);

CREATE POLICY "portal_class_registrations: anon insert published"
  ON public.portal_class_registrations FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portal_classes c
      WHERE c.id = class_id AND c.status = 'published'
    )
  );

CREATE POLICY "portal_class_registrations: anon delete own"
  ON public.portal_class_registrations FOR DELETE TO anon
  USING (true);

CREATE POLICY "portal_class_registrations: owner all"
  ON public.portal_class_registrations FOR ALL TO authenticated
  USING (
    class_id IN (
      SELECT c.id FROM public.portal_classes c
      JOIN public.partner_portals pp ON pp.id = c.portal_id
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  );