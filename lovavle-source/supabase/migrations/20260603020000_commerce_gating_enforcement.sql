-- ── Enforcement del toggle Bullfy eCommerce (portal_commerce_access) ──
-- El toggle vive por ib_id en portal_commerce_access.enabled. Hasta ahora solo
-- gateaba la UI (pestaña Tienda) y nada en el backend. Esta migración:
--   1) Crea un helper reutilizable portal_commerce_enabled(_portal_id) usable tanto
--      en RLS como desde las Edge Functions (vía RPC).
--   2) Corrige la RLS de inscripción gratis a eventos: si el portal NO tiene eCommerce
--      activo, el usuario puede inscribirse GRATIS a cualquier evento publicado, aunque
--      en BD tenga is_free=false/precio (el precio se conserva por si reactivan el
--      eCommerce, pero no se cobra). Sin esto, un evento "pago" creado con eCommerce ON
--      y luego apagado quedaba imposible de inscribir (la UI lo muestra gratis pero la
--      RLS exigía is_free=true).

-- 1) Helper: ¿el portal tiene Bullfy eCommerce activo?
--    enabled=true en portal_commerce_access para el ib_id del portal. Si no hay fila o
--    enabled=false → comercio apagado (no puede cobrar).
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

-- 2) RLS de inscripción gratis a eventos: permitir si el evento es gratis O si el portal
--    no tiene eCommerce activo (en cuyo caso TODO es gratis para sus usuarios).
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
