CREATE TABLE public.portal_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  timezone        TEXT NOT NULL DEFAULT 'America/Bogota',
  event_type      TEXT NOT NULL DEFAULT 'webinar',
  location_type   TEXT NOT NULL DEFAULT 'online',
  location_url    TEXT,
  is_free         BOOLEAN NOT NULL DEFAULT true,
  price_usd       NUMERIC(10,2) NOT NULL DEFAULT 0,
  required_tiers  TEXT[],
  capacity        INTEGER,
  status          TEXT NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_events TO authenticated;
GRANT ALL ON public.portal_events TO service_role;

CREATE INDEX idx_portal_events_portal_id ON public.portal_events(portal_id);
CREATE INDEX idx_portal_events_starts_at ON public.portal_events(starts_at);
CREATE INDEX idx_portal_events_status    ON public.portal_events(status);

CREATE TABLE public.portal_event_registrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.portal_events(id) ON DELETE CASCADE,
  partner_user_id  UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by       TEXT NOT NULL DEFAULT 'free',
  UNIQUE (event_id, partner_user_id)
);

GRANT SELECT, INSERT ON public.portal_event_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_event_registrations TO authenticated;
GRANT ALL ON public.portal_event_registrations TO service_role;

CREATE INDEX idx_portal_event_reg_event ON public.portal_event_registrations(event_id);
CREATE INDEX idx_portal_event_reg_user  ON public.portal_event_registrations(partner_user_id);

ALTER TABLE public.portal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_events: anon read published"
  ON public.portal_events FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "portal_events: owner all"
  ON public.portal_events FOR ALL TO authenticated
  USING (portal_id IN (SELECT id FROM public.partner_portals WHERE ib_id = auth.uid()))
  WITH CHECK (portal_id IN (SELECT id FROM public.partner_portals WHERE ib_id = auth.uid()));

CREATE POLICY "portal_event_registrations: anon read"
  ON public.portal_event_registrations FOR SELECT TO anon
  USING (true);

CREATE POLICY "portal_event_registrations: anon insert free"
  ON public.portal_event_registrations FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portal_events e
      WHERE e.id = event_id
        AND e.is_free = true
        AND e.status = 'published'
    )
  );

CREATE POLICY "portal_event_registrations: owner all"
  ON public.portal_event_registrations FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT pe.id FROM public.portal_events pe
      JOIN public.partner_portals pp ON pp.id = pe.portal_id
      WHERE pp.ib_id = auth.uid()
    )
  );