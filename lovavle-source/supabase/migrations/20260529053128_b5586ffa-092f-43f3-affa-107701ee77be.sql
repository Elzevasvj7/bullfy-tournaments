DROP POLICY IF EXISTS "portal_events: owner all" ON public.portal_events;

CREATE POLICY "portal_events: owner all"
  ON public.portal_events FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_events.portal_id AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_events.portal_id AND p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "portal_event_registrations: owner all" ON public.portal_event_registrations;

CREATE POLICY "portal_event_registrations: owner all"
  ON public.portal_event_registrations FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT pe.id FROM public.portal_events pe
      JOIN public.partner_portals pp ON pp.id = pe.portal_id
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  );