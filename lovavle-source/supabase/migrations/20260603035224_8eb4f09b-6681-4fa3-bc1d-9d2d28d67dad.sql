CREATE OR REPLACE FUNCTION public.portal_commerce_enabled(_portal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partner_portals pp
    JOIN public.portal_commerce_access pca ON pca.ib_id = pp.ib_id
    WHERE pp.id = _portal_id
      AND pca.enabled = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.portal_commerce_enabled(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "portal_event_registrations: anon insert free" ON public.portal_event_registrations;
CREATE POLICY "portal_event_registrations: anon insert free"
  ON public.portal_event_registrations FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portal_events e
      WHERE e.id = event_id
        AND e.status = 'published'
        AND (
          e.is_free = true
          OR NOT public.portal_commerce_enabled(e.portal_id)
        )
    )
  );