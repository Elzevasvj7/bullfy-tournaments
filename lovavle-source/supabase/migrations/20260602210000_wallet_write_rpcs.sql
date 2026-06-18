-- ── Escrituras de wallet server-side (seguras) ──
-- Las tablas portal_user_wallets / portal_withdrawal_requests tienen RLS con solo
-- políticas SELECT, así que las escrituras directas desde el cliente fallan, y el
-- débito optimista en el front era un hueco (el cliente no debe mutar su saldo).
--
-- Estos RPCs SECURITY DEFINER hacen la reserva + inserción de forma ATÓMICA y VALIDAN
-- el saldo en el servidor: nadie puede sobre-retirar ni auto-acreditarse. Sirven tanto
-- para el partner_user del storefront como para el IB (host). El monto disponible es la
-- única fuente de verdad (no se confía en nada que envíe el cliente salvo el monto a pedir).

-- 1) Crear solicitud de retiro: valida mínimo/saldo, reserva (debita available) e inserta.
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
  _wallet        RECORD;
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

  SELECT COALESCE(withdrawal_fee_usdt, 0), COALESCE(min_withdrawal_usdt, 0)
    INTO _fee, _min
  FROM public.portal_mlm_config WHERE portal_id = _portal_id;
  _fee := COALESCE(_fee, 0);
  _min := COALESCE(_min, 0);

  IF _amount < _min THEN RAISE EXCEPTION 'below_minimum'; END IF;
  IF _amount > _wallet.available_balance THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  _net := round(_amount - _fee, 2);
  IF _net <= 0 THEN RAISE EXCEPTION 'net_non_positive'; END IF;

  -- Reserva: debita available (server-side, no en el cliente).
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
    reference_id, reference_type, description, account_kind
  ) VALUES (
    _wallet.id, _portal_id, _user_id, 'withdrawal_request', _amount,
    _new_pending, _new_available, _wid, 'withdrawal',
    'Reserva por solicitud de retiro', _kind
  );

  RETURN _wid;
END;
$$;

-- 2) Guardar destino de cobro (dirección USDT TRC20 y/o destino Stripe) del wallet.
CREATE OR REPLACE FUNCTION public.set_partner_wallet_destination(
  _portal_id          uuid,
  _user_id            uuid,
  _usdt_address       text DEFAULT NULL,
  _stripe_destination text DEFAULT NULL,
  _account_kind       text DEFAULT 'real'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wid uuid;
BEGIN
  _wid := public.get_or_create_user_wallet(_portal_id, _user_id, COALESCE(_account_kind, 'real'));
  UPDATE public.portal_user_wallets
     SET external_wallet_address = COALESCE(_usdt_address, external_wallet_address),
         stripe_destination      = COALESCE(_stripe_destination, stripe_destination),
         updated_at              = now()
   WHERE id = _wid;
END;
$$;

-- Callables por el storefront (anon) y por el IB (authenticated). La seguridad real está
-- DENTRO del RPC (validación de saldo server-side); no se confía en el cliente.
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(uuid,uuid,numeric,text,text,text,text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_partner_wallet_destination(uuid,uuid,text,text,text)          TO anon, authenticated;
