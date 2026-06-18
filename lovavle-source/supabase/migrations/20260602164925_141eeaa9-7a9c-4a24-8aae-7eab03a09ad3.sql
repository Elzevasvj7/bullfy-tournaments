-- ===== Migration 1: 20260602200000_unified_ib_wallet_phase1.sql =====
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.portal_wallet_transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%transaction_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.portal_wallet_transactions DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.portal_wallet_transactions
  ADD CONSTRAINT portal_wallet_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'commission_pending', 'business_partner_commission_pending', 'release_to_available',
    'withdrawal_request', 'withdrawal_completed', 'withdrawal_failed', 'platform_fee',
    'refund_reversal', 'manual_adjustment', 'demo_purchase', 'portal_owner_earning'
  ));

CREATE OR REPLACE FUNCTION public.get_portal_host_user_id(_portal_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.partner_users
  WHERE portal_id = _portal_id AND is_host = true
  ORDER BY created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.release_due_portal_owner_commissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c             RECORD;
  _host          uuid;
  _wallet        uuid;
  _new_pending   numeric(12,2);
  _new_available numeric(12,2);
  _income_type   text;
  _count         int := 0;
BEGIN
  FOR _c IN
    SELECT pc.id, pc.portal_id, pc.amount, pc.account_kind, pc.order_id
    FROM public.portal_commissions pc
    WHERE pc.status = 'pending'
      AND pc.beneficiary_type = 'portal_owner'
      AND pc.created_at <= now() - (
        COALESCE((SELECT refund_window_days FROM public.portal_mlm_config WHERE portal_id = pc.portal_id), 7)
        || ' days'
      )::interval
    ORDER BY pc.created_at ASC
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  LOOP
    _host := public.get_portal_host_user_id(_c.portal_id);
    IF _host IS NULL THEN
      CONTINUE;
    END IF;

    _wallet := public.get_or_create_user_wallet(_c.portal_id, _host, COALESCE(_c.account_kind, 'real'));

    SELECT CASE
             WHEN o.event_id IS NOT NULL THEN 'event'
             ELSE COALESCE((
               SELECT pp.product_type
               FROM public.portal_order_items oi
               JOIN public.portal_products pp ON pp.id = oi.product_id
               WHERE oi.order_id = _c.order_id
               LIMIT 1
             ), 'sale')
           END
      INTO _income_type
    FROM public.portal_orders o
    WHERE o.id = _c.order_id;

    UPDATE public.portal_user_wallets
       SET available_balance = available_balance + _c.amount,
           total_earned      = total_earned + _c.amount,
           updated_at        = now()
     WHERE id = _wallet
    RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

    INSERT INTO public.portal_wallet_transactions (
      wallet_id, portal_id, user_id, transaction_type, amount,
      balance_after_pending, balance_after_available,
      reference_id, reference_type, description, metadata, account_kind
    ) VALUES (
      _wallet, _c.portal_id, _host, 'portal_owner_earning', _c.amount,
      _new_pending, _new_available,
      _c.id, 'portal_commission',
      'Ingreso por venta (' || COALESCE(_income_type, 'sale') || ')',
      jsonb_build_object('order_id', _c.order_id, 'income_type', COALESCE(_income_type, 'sale')),
      COALESCE(_c.account_kind, 'real')
    );

    UPDATE public.portal_commissions
       SET status = 'available', updated_at = now()
     WHERE id = _c.id;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_due_portal_owner_commissions() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_portal_host_user_id(uuid) FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-portal-owner-commissions-hourly') THEN
      PERFORM cron.schedule(
        'release-portal-owner-commissions-hourly',
        '15 * * * *',
        'SELECT public.release_due_portal_owner_commissions();'
      );
    END IF;
  END IF;
END $$;

-- ===== Migration 2: 20260602210000_wallet_write_rpcs.sql =====
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

GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(uuid,uuid,numeric,text,text,text,text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_partner_wallet_destination(uuid,uuid,text,text,text)          TO anon, authenticated;

-- ===== Migration 3: 20260602220000_live_earnings_to_wallet.sql =====
ALTER TABLE public.live_streamer_earnings
  ADD COLUMN IF NOT EXISTS wallet_credited_at timestamptz;

DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.portal_wallet_transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%transaction_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.portal_wallet_transactions DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.portal_wallet_transactions
  ADD CONSTRAINT portal_wallet_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'commission_pending', 'business_partner_commission_pending', 'release_to_available',
    'withdrawal_request', 'withdrawal_completed', 'withdrawal_failed', 'platform_fee',
    'refund_reversal', 'manual_adjustment', 'demo_purchase', 'portal_owner_earning',
    'live_earnings_credit'
  ));

CREATE OR REPLACE FUNCTION public.resolve_live_host_to_portal_and_user(_host_id uuid)
RETURNS TABLE (portal_id uuid, host_partner_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.id, pu.id
  FROM public.live_rooms lr
  JOIN public.partner_portals pp ON pp.id = lr.portal_id
  JOIN public.partner_users pu ON pu.portal_id = pp.id AND pu.is_host = true
  WHERE lr.host_id = _host_id AND lr.portal_id IS NOT NULL
  ORDER BY pu.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.approve_and_credit_live_earnings(_host_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _portal        uuid;
  _host_pu       uuid;
  _wallet        uuid;
  _e             RECORD;
  _credited      numeric(12,2) := 0;
  _count         int := 0;
  _new_pending   numeric(12,2);
  _new_available numeric(12,2);
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')) THEN
    RAISE EXCEPTION 'unauthorized: requires admin or global_admin';
  END IF;

  UPDATE public.live_streamer_earnings
     SET status = 'paid', updated_at = now()
   WHERE host_id = _host_id AND status = 'pending';

  SELECT portal_id, host_partner_user_id INTO _portal, _host_pu
  FROM public.resolve_live_host_to_portal_and_user(_host_id);

  IF _portal IS NULL OR _host_pu IS NULL THEN
    RETURN jsonb_build_object('paid', true, 'credited', false, 'reason', 'host_portal_unresolved');
  END IF;

  _wallet := public.get_or_create_user_wallet(_portal, _host_pu, 'real');

  FOR _e IN
    SELECT id, earnings_total
    FROM public.live_streamer_earnings
    WHERE host_id = _host_id AND status = 'paid'
      AND wallet_credited_at IS NULL AND earnings_total > 0
    FOR UPDATE
  LOOP
    UPDATE public.portal_user_wallets
       SET available_balance = available_balance + _e.earnings_total,
           total_earned      = total_earned + _e.earnings_total,
           updated_at        = now()
     WHERE id = _wallet
    RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

    INSERT INTO public.portal_wallet_transactions (
      wallet_id, portal_id, user_id, transaction_type, amount,
      balance_after_pending, balance_after_available,
      reference_id, reference_type, description, metadata, account_kind
    ) VALUES (
      _wallet, _portal, _host_pu, 'live_earnings_credit', _e.earnings_total,
      _new_pending, _new_available, _e.id, 'live_streamer_earnings',
      'Ingreso por Bullfy Live',
      jsonb_build_object('income_type', 'live', 'host_auth_id', _host_id),
      'real'
    );

    UPDATE public.live_streamer_earnings SET wallet_credited_at = now() WHERE id = _e.id;
    _credited := _credited + _e.earnings_total;
    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('paid', true, 'credited', true, 'amount', _credited, 'count', _count);
END;
$$;

REVOKE ALL    ON FUNCTION public.resolve_live_host_to_portal_and_user(uuid) FROM anon, authenticated;
REVOKE ALL    ON FUNCTION public.approve_and_credit_live_earnings(uuid)     FROM anon;
GRANT  EXECUTE ON FUNCTION public.approve_and_credit_live_earnings(uuid)     TO authenticated;