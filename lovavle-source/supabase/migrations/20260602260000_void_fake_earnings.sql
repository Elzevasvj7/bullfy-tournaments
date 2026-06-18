-- ── Integridad financiera: anular ganancias FICTICIAS (órdenes sin cobro real) ──
-- Riesgo go-live: muchos wallets tienen saldo de órdenes marcadas 'paid' SIN cobro real
-- (bug C3 de stripe_gateway, y Coinsbuy sandbox que nunca se integró en producción).
-- Solo los pagos por NOWPayments fueron cobros reales. Si esto queda, IBs y usuarios
-- podrían retirar dinero que nunca se cobró.
--
-- Acciones:
--   1) A FUTURO: la liberación al wallet del IB solo acredita órdenes de gateway con
--      verificación real (coinsbuy/nowpayments). (stripe_gateway/simulated nunca acreditan.)
--   2) EXISTENTE: revierte y anula las ganancias portal_owner y MLM derivadas de órdenes
--      cuyo gateway NO sea 'nowpayments' (= coinsbuy sandbox + stripe_gateway + simulated).
--      Conserva solo lo de NOWPayments (lo efectivamente cobrado). Auditable e idempotente.
-- NOTA: el bug C3 ya impide marcar 'paid' sin pasarela real → no se crean nuevas órdenes
-- ficticias; esto limpia las históricas.

-- 1) Filtro a futuro en la liberación portal_owner.
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
                  WHERE o.id = pc.order_id AND o.payment_gateway IN ('coinsbuy','nowpayments'))
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
      AND EXISTS (SELECT 1 FROM public.portal_orders o WHERE o.id=pc.order_id AND o.payment_gateway IN ('coinsbuy','nowpayments'))
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

-- 2) Revertir + anular ganancias portal_owner de órdenes NO-nowpayments (ficticias).
DO $$
DECLARE c RECORD; _w uuid; _np numeric(12,2); _na numeric(12,2);
BEGIN
  FOR c IN
    SELECT pc.id, pc.portal_id, pc.amount, pc.status, pc.account_kind
    FROM public.portal_commissions pc
    JOIN public.portal_orders o ON o.id = pc.order_id
    WHERE pc.beneficiary_type='portal_owner'
      AND pc.status <> 'cancelled'
      AND COALESCE(o.payment_gateway,'') <> 'nowpayments'
  LOOP
    SELECT t.wallet_id INTO _w
    FROM public.portal_wallet_transactions t
    WHERE t.reference_id=c.id AND t.reference_type='portal_commission' AND t.transaction_type='portal_owner_earning'
    ORDER BY t.created_at DESC LIMIT 1;
    IF _w IS NOT NULL THEN
      IF c.status='available' THEN
        UPDATE public.portal_user_wallets SET available_balance=GREATEST(0,available_balance-c.amount), total_earned=GREATEST(0,total_earned-c.amount), updated_at=now() WHERE id=_w RETURNING pending_balance, available_balance INTO _np,_na;
      ELSE
        UPDATE public.portal_user_wallets SET pending_balance=GREATEST(0,pending_balance-c.amount), total_earned=GREATEST(0,total_earned-c.amount), updated_at=now() WHERE id=_w RETURNING pending_balance, available_balance INTO _np,_na;
      END IF;
      INSERT INTO public.portal_wallet_transactions (wallet_id, portal_id, user_id, transaction_type, amount, balance_after_pending, balance_after_available, reference_id, reference_type, description, account_kind)
        SELECT _w, c.portal_id, w.user_id, 'manual_adjustment', -c.amount, _np, _na, c.id, 'portal_commission', 'Reverso: orden no cobrada (gateway ficticio/no integrado)', COALESCE(c.account_kind,'real') FROM public.portal_user_wallets w WHERE w.id=_w;
    END IF;
    UPDATE public.portal_commissions SET status='cancelled' WHERE id=c.id;
  END LOOP;
END $$;

-- 3) Revertir + anular comisiones MLM de órdenes NO-nowpayments (ficticias).
DO $$
DECLARE m RECORD; _w uuid; _np numeric(12,2); _na numeric(12,2);
BEGIN
  FOR m IN
    SELECT mc.id, mc.portal_id, mc.beneficiary_user_id, mc.commission_amount, mc.status, mc.account_kind
    FROM public.portal_mlm_commissions mc
    JOIN public.portal_orders o ON o.id = mc.order_id
    WHERE mc.status IN ('pending','available')
      AND COALESCE(o.payment_gateway,'') <> 'nowpayments'
  LOOP
    IF m.beneficiary_user_id IS NOT NULL THEN
      SELECT id INTO _w FROM public.portal_user_wallets
       WHERE portal_id=m.portal_id AND user_id=m.beneficiary_user_id AND account_kind=COALESCE(m.account_kind,'real');
      IF _w IS NOT NULL THEN
        IF m.status='available' THEN
          UPDATE public.portal_user_wallets SET available_balance=GREATEST(0,available_balance-m.commission_amount), total_earned=GREATEST(0,total_earned-m.commission_amount), updated_at=now() WHERE id=_w RETURNING pending_balance, available_balance INTO _np,_na;
        ELSE
          UPDATE public.portal_user_wallets SET pending_balance=GREATEST(0,pending_balance-m.commission_amount), total_earned=GREATEST(0,total_earned-m.commission_amount), updated_at=now() WHERE id=_w RETURNING pending_balance, available_balance INTO _np,_na;
        END IF;
        INSERT INTO public.portal_wallet_transactions (wallet_id, portal_id, user_id, transaction_type, amount, balance_after_pending, balance_after_available, reference_id, reference_type, description, account_kind)
          VALUES (_w, m.portal_id, m.beneficiary_user_id, 'manual_adjustment', -m.commission_amount, _np, _na, m.id, 'mlm_commission', 'Reverso: comisión MLM de orden no cobrada (ficticia)', COALESCE(m.account_kind,'real'));
      END IF;
    END IF;
    UPDATE public.portal_mlm_commissions SET status='reversed', reversed_reason='Orden no cobrada (gateway ficticio/no integrado)' WHERE id=m.id;
  END LOOP;
END $$;
