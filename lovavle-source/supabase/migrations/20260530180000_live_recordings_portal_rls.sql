-- ============================================================================
-- Aislar live_recordings por portal (fix de fuga entre IBs)
-- ============================================================================
-- La policy original era `FOR SELECT TO authenticated USING (true)`, lo que
-- dejaba que CUALQUIER usuario autenticado (cualquier IB admin) leyera TODAS
-- las grabaciones de todos los portales.
--
-- Nueva regla: un IB admin solo ve las grabaciones de las salas de SU portal
-- (puente recording → live_rooms.portal_id → partner_portals → profiles =
-- auth.uid()). admin/global_admin siguen viendo todo (incluidas las salas
-- internas de Bullfy con portal_id NULL).
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view recordings" ON public.live_recordings;
-- Idempotente: si se corre más de una vez (ej. manual + luego Lovable), no falla.
DROP POLICY IF EXISTS "live_recordings: view own portal or admin" ON public.live_recordings;

CREATE POLICY "live_recordings: view own portal or admin"
  ON public.live_recordings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR room_id IN (
      SELECT lr.id
      FROM public.live_rooms lr
      JOIN public.partner_portals pp ON pp.id = lr.portal_id
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE p.id = auth.uid()
    )
  );
