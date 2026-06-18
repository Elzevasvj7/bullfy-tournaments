-- ── Acreditar al wallet del IB los cobros REALES por Stripe ──
-- La función release_due_portal_owner_commissions (cron) solo acreditaba/liberaba
-- comisiones de órdenes con gateway IN ('coinsbuy','nowpayments'). Ahora que Stripe
-- entra a PRODUCCIÓN con confirmación real vía webhook (stripe-webhook, verificación
-- server-to-server + firma), sus cobros también son reales y deben llegar al wallet.
--
-- Se añade 'stripe_gateway' al filtro de gateway en AMBOS pasos. Es seguro:
--   • Las comisiones de las órdenes Stripe FICTICIAS históricas ya fueron 'cancelled'
--     por 20260602260000, así que NO serán recogidas (el loop exige status='pending').
--   • Solo las comisiones nuevas creadas por stripe-webhook (status='pending') se
--     acreditan/liberan, igual que coinsbuy/nowpayments.
-- Resto de la función idéntico a 20260602260000.

CREATE OR REPLACE FUNCTION public.release_due_portal_owner_commissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c RECORD; _host uuid; _wallet uuid; _income_type text;
  _np numeric(12,2); _na numeric(12,2); _released int := 0;
BEGIN
  -- PASO 1 — acreditar a PENDIENTE (solo órdenes de gateway real verificado).
  FOR _c IN
    SELECT pc.id, pc.portal_id, pc.amount, pc.account_kind, pc.order_id
    FROM public.portal_commissions pc
    WHERE pc.beneficiary_type = 'portal_owner'
      AND pc.status = 'pending'
      AND pc.pending_credited_at IS NULL
      AND EXISTS (SELECT 1 FROM public.portal_orders o
                  WHERE o.id = pc.order_id AND o.payment_gateway IN ('coinsbuy','nowpayments','stripe_gateway'))
    ORDER BY pc.created_at ASC
    LIMIT 500 FOR UPDATE SKIP LOCKED
  LOOP
    _host := public.get_portal_host_user_id(_c.portal_id);
    IF _host IS NULL THEN CONTINUE; END IF;
    _wallet := public.get_or_create_user_wallet(_c.portal_id, _host, COALESCE(_c.account_kind,'real'));
    SELECT CASE WHEN o.event_id IS NOT NULL THEN 'event'
                ELSE COALESCE((SELECT pp.product_type FROM public.portal_order_items oi
                               JOIN public.portal_products pp ON pp.id=oi.product_id
                               WHERE oi.order_id=_c.order_id LIMIT 1),'sale') END
      INTO _income_type FROM public.portal_orders o WHERE o.id=_c.order_id;
    UPDATE public.portal_user_wallets
       SET pending_balance = pending_balance + _c.amount, total_earned = total_earned + _c.amount, updated_at = now()
     WHERE id = _wallet RETURNING pending_balance, available_balance INTO _np, _na;
    INSERT INTO public.portal_wallet_transactions (wallet_id, portal_id, user_id, transaction_type, amount, balance_after_pending, balance_after_available, reference_id, reference_type, description, metadata, account_kind)
      VALUES (_wallet, _c.portal_id, _host, 'portal_owner_earning', _c.amount, _np, _na, _c.id, 'portal_commission',
              'Ingreso por venta ('||COALESCE(_income_type,'sale')||') — pendiente',
              jsonb_build_object('order_id',_c.order_id,'income_type',COALESCE(_income_type,'sale')), COALESCE(_c.account_kind,'real'));
    UPDATE public.portal_commissions SET pending_credited_at = now() WHERE id = _c.id;
  END LOOP;

  -- PASO 2 — liberar PENDIENTE→DISPONIBLE las vencidas (mismo filtro de gateway).
  FOR _c IN
    SELECT pc.id, pc.portal_id, pc.amount, pc.account_kind
    FROM public.portal_commissions pc
    WHERE pc.beneficiary_type='portal_owner' AND pc.status='pending' AND pc.pending_credited_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.portal_orders o WHERE o.id=pc.order_id AND o.payment_gateway IN ('coinsbuy','nowpayments','stripe_gateway'))
      AND pc.created_at <= now() - (COALESCE((SELECT refund_window_days FROM public.portal_mlm_config WHERE portal_id=pc.portal_id),7)||' days')::interval
    ORDER BY pc.created_at ASC
    LIMIT 500 FOR UPDATE SKIP LOCKED
  LOOP
    _host := public.get_portal_host_user_id(_c.portal_id);
    IF _host IS NULL THEN CONTINUE; END IF;
    _wallet := public.get_or_create_user_wallet(_c.portal_id, _host, COALESCE(_c.account_kind,'real'));
    UPDATE public.portal_user_wallets
       SET pending_balance = GREATEST(0, pending_balance - _c.amount), available_balance = available_balance + _c.amount, updated_at=now()
     WHERE id=_wallet RETURNING pending_balance, available_balance INTO _np, _na;
    INSERT INTO public.portal_wallet_transactions (wallet_id, portal_id, user_id, transaction_type, amount, balance_after_pending, balance_after_available, reference_id, reference_type, description, account_kind)
      VALUES (_wallet, _c.portal_id, _host, 'release_to_available', _c.amount, _np, _na, _c.id, 'portal_commission', 'Ingreso por venta liberado', COALESCE(_c.account_kind,'real'));
    UPDATE public.portal_commissions SET status='available' WHERE id=_c.id;
    _released := _released + 1;
  END LOOP;
  RETURN _released;
END;
$$;
REVOKE ALL ON FUNCTION public.release_due_portal_owner_commissions() FROM anon, authenticated;
