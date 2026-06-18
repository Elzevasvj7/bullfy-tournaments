GRANT SELECT ON public.portal_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_events TO authenticated;
GRANT ALL ON public.portal_events TO service_role;

GRANT SELECT, INSERT ON public.portal_event_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_event_registrations TO authenticated;
GRANT ALL ON public.portal_event_registrations TO service_role;