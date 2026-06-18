-- ── RLS: el IB OPERADOR puede LEER su wallet ──
-- Las políticas SELECT de las tablas de wallet autorizaban por `ibs.created_by = auth.uid()`
-- (el CREADOR del portal, que a veces es un admin de Bullfy), NO por el IB operador. Por eso
-- el IB (p. ej. karloshemalaya, cuyo profiles.ib_id = el ib del portal) NO podía leer su
-- propio wallet → la UI salía vacía (sin saldo, sin poder configurar destino ni retirar).
--
-- Se alinean al patrón canónico que usan academy/orders/etc.: profiles.ib_id = portal.ib_id
-- (el IB operador) + admins/global_admins (soporte / Finanzas global). Solo afecta LECTURA;
-- las escrituras ya van por RPCs SECURITY DEFINER.

-- portal_user_wallets
DROP POLICY IF EXISTS "Portal owners view wallets of their portal" ON public.portal_user_wallets;
CREATE POLICY "Portal IB views wallets of their portal"
  ON public.portal_user_wallets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_user_wallets.portal_id AND p.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- portal_wallet_transactions
DROP POLICY IF EXISTS "Portal owners view wallet transactions of their portal" ON public.portal_wallet_transactions;
CREATE POLICY "Portal IB views wallet transactions of their portal"
  ON public.portal_wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_wallet_transactions.portal_id AND p.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- portal_withdrawal_requests
DROP POLICY IF EXISTS "Portal owners view withdrawals of their portal" ON public.portal_withdrawal_requests;
CREATE POLICY "Portal IB views withdrawals of their portal"
  ON public.portal_withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_withdrawal_requests.portal_id AND p.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );
