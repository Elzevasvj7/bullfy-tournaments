-- ── Wallet unificado del IB — Fase 3: folding de Bullfy Live ──
-- Al aprobar las ganancias de Live (status→'paid'), se acreditan al wallet unificado del
-- host (portal_user_wallets) etiquetadas como income_type='live'. El retiro pasa a ser
-- ÚNICO (vía el wallet unificado); el legacy streamer (PartnerWallet) queda solo-lectura.
--
-- Identidad: live_streamer_earnings.host_id = auth.users.id (no tiene portal_id). Se mapea
-- host → portal vía live_rooms.portal_id → partner_users(is_host) del portal.
-- Idempotente: wallet_credited_at evita doble acreditación (y permite reintento).

-- 1) Flag para no acreditar dos veces.
ALTER TABLE public.live_streamer_earnings
  ADD COLUMN IF NOT EXISTS wallet_credited_at timestamptz;

-- 2) Nuevo transaction_type 'live_earnings_credit'.
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

-- 3) Resuelve host (auth.users.id) → (portal_id, host partner_users.id).
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

-- 4) Aprobar + acreditar ganancias de Live al wallet unificado (admin, idempotente).
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

  -- Marcar pagadas las pendientes del host.
  UPDATE public.live_streamer_earnings
     SET status = 'paid', updated_at = now()
   WHERE host_id = _host_id AND status = 'pending';

  -- Resolver portal + host partner_user.
  SELECT portal_id, host_partner_user_id INTO _portal, _host_pu
  FROM public.resolve_live_host_to_portal_and_user(_host_id);

  -- Si no se puede mapear (host sin portal / sin registro host), queda pagado pero sin
  -- acreditar; un reintento posterior (re-aprobar) lo acredita cuando exista el mapeo.
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
