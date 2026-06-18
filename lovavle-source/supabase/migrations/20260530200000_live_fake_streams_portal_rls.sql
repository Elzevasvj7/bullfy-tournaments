-- ============================================================================
-- Aislar live_fake_streams por portal (hardening RLS)
-- ============================================================================
-- La policy de SELECT para authenticated era `USING (true)`: aunque la UI ya
-- filtra por portal_id, a nivel de API cualquier IB autenticado podía leer la
-- metadata de los falsos en vivo de otros portales.
--
-- Nueva regla: un IB admin solo ve los falsos en vivo de SU portal
-- (live_fake_streams.portal_id → partner_portals → profiles = auth.uid()).
-- admin/global_admin ven todo (incluidos los internos con portal_id NULL).
--
-- NO se toca la policy anon ("Public can view active fake streams",
-- is_active = true) que usa el visor público por slug, ni las de INSERT/
-- UPDATE/DELETE (ya limitadas a created_by).
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view fake streams" ON public.live_fake_streams;
-- Idempotente: re-ejecutable (manual + Lovable) sin error.
DROP POLICY IF EXISTS "live_fake_streams: view own portal or admin" ON public.live_fake_streams;

CREATE POLICY "live_fake_streams: view own portal or admin"
  ON public.live_fake_streams FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR portal_id IN (
      SELECT pp.id
      FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  );
