-- ============================================================================
-- COMISIONES — FASE 4 (base de datos): retiros POR MÉTODO
-- ----------------------------------------------------------------------------
-- Hasta ahora los retiros validaban/reservaban contra el agregado legacy
-- (portal_user_wallets.available_balance), mezclando fondos cripto y fiat. Ahora
-- cada retiro opera sobre el BUCKET del método (portal_wallet_balances):
--   payout_method 'usdt_trc20' → bucket 'usdt'; 'stripe' → bucket 'stripe'.
-- Se mantiene el agregado SINCRONIZADO (bucket y agregado se mueven juntos) para
-- no romper nada que aún lea el agregado. Así: solo puedes retirar fiat de lo
-- recaudado por Stripe, y cripto de lo recaudado por USDT.
-- Idempotente (CREATE OR REPLACE). Mismas firmas → callers sin cambios.
-- ============================================================================

-- (1) create_withdrawal_request — valida y reserva contra el BUCKET del método.
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  _portal_id           uuid,
  _user_id             uuid,
  _amount              numeric,
  _payout_method       text,
  _destination_address text DEFAULT NULL,
  _stripe_destination  text DEFAULT NULL,
  _account_kind        text DEFAULT 'real'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kind          text := COALESCE(_account_kind, 'real');
  _bucket        text := CASE WHEN _payout_method = 'stripe' THEN 'stripe' ELSE 'usdt' END;
  _wallet        RECORD;
  _bal_avail     numeric(12,2) := 0;
  _fee           numeric(12,2);
  _min           numeric(12,2);
  _net           numeric(12,2);
  _wid           uuid;
  _new_pending   numeric(12,2);
  _new_available numeric(12,2);
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT * INTO _wallet
  FROM public.portal_user_wallets
  WHERE portal_id = _portal_id AND user_id = _user_id AND account_kind = _kind
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;

  -- Disponible del MÉTODO (bucket). Si no existe el bucket → 0.
  SELECT COALESCE(available_balance,0) INTO _bal_avail
  FROM public.portal_wallet_balances
  WHERE wallet_id = _wallet.id AND method = _bucket
  FOR UPDATE;
  IF NOT FOUND THEN _bal_avail := 0; END IF;

  SELECT COALESCE(withdrawal_fee_usdt, 0), COALESCE(min_withdrawal_usdt, 0)
    INTO _fee, _min
  FROM public.portal_mlm_config WHERE portal_id = _portal_id;
  _fee := COALESCE(_fee, 0);
  _min := COALESCE(_min, 0);

  IF _amount < _min THEN RAISE EXCEPTION 'below_minimum'; END IF;
  IF _amount > _bal_avail THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  -- Defensa ante drift del invariante: error de negocio claro en vez de violar el CHECK.
  IF _amount > _wallet.available_balance THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  _net := round(_amount - _fee, 2);
  IF _net <= 0 THEN RAISE EXCEPTION 'net_non_positive'; END IF;

  -- Reserva en el bucket del método.
  UPDATE public.portal_wallet_balances
     SET available_balance = available_balance - _amount, updated_at = now()
   WHERE wallet_id = _wallet.id AND method = _bucket;

  -- Reserva en el agregado legacy (mantiene agregado = Σ buckets).
  UPDATE public.portal_user_wallets
     SET available_balance = available_balance - _amount, updated_at = now()
   WHERE id = _wallet.id
  RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

  INSERT INTO public.portal_withdrawal_requests (
    portal_id, user_id, wallet_id, amount_requested, fee_amount, amount_net,
    currency, network, destination_address, payout_method, stripe_destination,
    status, account_kind
  ) VALUES (
    _portal_id, _user_id, _wallet.id, _amount, _fee, _net,
    CASE WHEN _payout_method = 'stripe' THEN 'USD' ELSE 'USDT' END,
    CASE WHEN _payout_method = 'usdt_trc20' THEN 'TRC20' ELSE NULL END,
    _destination_address, _payout_method, _stripe_destination,
    'pending', _kind
  ) RETURNING id INTO _wid;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description, metadata, account_kind
  ) VALUES (
    _wallet.id, _portal_id, _user_id, 'withdrawal_request', _amount,
    _new_pending, _new_available, _wid, 'withdrawal',
    'Reserva por solicitud de retiro', jsonb_build_object('method', _bucket), _kind
  );

  RETURN _wid;
END;
$$;
REVOKE ALL ON FUNCTION public.create_withdrawal_request(uuid,uuid,numeric,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(uuid,uuid,numeric,text,text,text,text) TO anon, authenticated;

-- (2) refund_withdrawal — reintegra al BUCKET del método + agregado.
CREATE OR REPLACE FUNCTION public.refund_withdrawal(_withdrawal_id UUID, _reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _w             RECORD;
  _bucket        text;
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  SELECT id, portal_id, user_id, wallet_id, amount_requested, status, account_kind, payout_method
    INTO _w
  FROM public.portal_withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF _w.status NOT IN ('pending', 'processing') THEN RETURN 'skipped'; END IF;

  _bucket := CASE WHEN _w.payout_method = 'stripe' THEN 'stripe' ELSE 'usdt' END;

  UPDATE public.portal_withdrawal_requests
     SET status = 'failed', failure_reason = _reason, updated_at = now()
   WHERE id = _withdrawal_id;

  -- Reintegro al bucket del método (crea el bucket si no existiera).
  INSERT INTO public.portal_wallet_balances (wallet_id, method, available_balance)
  VALUES (_w.wallet_id, _bucket, _w.amount_requested)
  ON CONFLICT (wallet_id, method) DO UPDATE
     SET available_balance = public.portal_wallet_balances.available_balance + EXCLUDED.available_balance,
         updated_at = now();

  UPDATE public.portal_user_wallets
     SET available_balance = available_balance + _w.amount_requested, updated_at = now()
   WHERE id = _w.wallet_id
  RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description, metadata, account_kind
  ) VALUES (
    _w.wallet_id, _w.portal_id, _w.user_id, 'withdrawal_failed', _w.amount_requested,
    _new_pending, _new_available, _withdrawal_id, 'withdrawal',
    'Reembolso por retiro fallido: ' || COALESCE(_reason, ''), jsonb_build_object('method', _bucket), _w.account_kind
  );

  RETURN 'refunded';
END;
$$;
REVOKE ALL ON FUNCTION public.refund_withdrawal(uuid, text) FROM PUBLIC;

-- (3) complete_withdrawal — total_withdrawn en BUCKET del método + agregado.
CREATE OR REPLACE FUNCTION public.complete_withdrawal(
  _withdrawal_id UUID, _payout_id TEXT DEFAULT NULL, _tx_hash TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _w             RECORD;
  _bucket        text;
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  SELECT id, portal_id, user_id, wallet_id, amount_net, payout_method, status, account_kind
    INTO _w
  FROM public.portal_withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  -- Solo completar retiros aún en curso (no re-completar ni completar reembolsados).
  IF _w.status NOT IN ('pending', 'processing') THEN RETURN 'skipped'; END IF;

  _bucket := CASE WHEN _w.payout_method = 'stripe' THEN 'stripe' ELSE 'usdt' END;

  UPDATE public.portal_withdrawal_requests
     SET status = 'completed', completed_at = now(), updated_at = now(),
         coinsbuy_payout_id = COALESCE(_payout_id, coinsbuy_payout_id),
         coinsbuy_tx_hash   = COALESCE(_tx_hash, coinsbuy_tx_hash)
   WHERE id = _withdrawal_id;

  -- UPSERT por simetría con refund (nunca diverge total_withdrawn bucket vs agregado).
  INSERT INTO public.portal_wallet_balances (wallet_id, method, total_withdrawn)
  VALUES (_w.wallet_id, _bucket, _w.amount_net)
  ON CONFLICT (wallet_id, method) DO UPDATE
     SET total_withdrawn = public.portal_wallet_balances.total_withdrawn + EXCLUDED.total_withdrawn,
         updated_at = now();

  UPDATE public.portal_user_wallets
     SET total_withdrawn = total_withdrawn + _w.amount_net, updated_at = now()
   WHERE id = _w.wallet_id
  RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description, metadata, account_kind
  ) VALUES (
    _w.wallet_id, _w.portal_id, _w.user_id, 'withdrawal_completed', _w.amount_net,
    _new_pending, _new_available, _withdrawal_id, 'withdrawal',
    'Retiro completado vía ' || COALESCE(_w.payout_method, ''), jsonb_build_object('method', _bucket), _w.account_kind
  );

  RETURN 'completed';
END;
$$;
REVOKE ALL ON FUNCTION public.complete_withdrawal(uuid, text, text) FROM PUBLIC;
