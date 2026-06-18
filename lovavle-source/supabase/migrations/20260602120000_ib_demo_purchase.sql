-- ============================================================================
-- P7.3 — Doble contabilidad IB: gasto de saldo demo (compra demo)
-- ----------------------------------------------------------------------------
-- Para que un "cliente demo" gaste su saldo DEMO en una orden demo (que luego
-- dispara las comisiones demo hacia arriba en el árbol MLM), se necesita:
--   1) un nuevo transaction_type 'demo_purchase' (débito del wallet demo);
--   2) un RPC atómico debit_demo_wallet que verifique saldo suficiente, debite
--      available_balance del wallet DEMO y registre la transacción — todo en una
--      transacción con FOR UPDATE (sin carreras / sin saldo negativo).
--
-- SEGURIDAD: el RPC SOLO opera sobre el wallet 'demo'. Por diseño jamás puede
-- debitar dinero real. Lo invoca la edge function portal-commerce (service_role).
-- Idempotente.
-- ============================================================================

-- ── (1) Ampliar el CHECK de transaction_type con 'demo_purchase' ────────────
ALTER TABLE public.portal_wallet_transactions
  DROP CONSTRAINT IF EXISTS portal_wallet_transactions_transaction_type_check;
ALTER TABLE public.portal_wallet_transactions
  ADD CONSTRAINT portal_wallet_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'commission_pending',
    'business_partner_commission_pending',
    'release_to_available',
    'withdrawal_request',
    'withdrawal_completed',
    'withdrawal_failed',
    'platform_fee',
    'refund_reversal',
    'manual_adjustment',
    'demo_purchase'
  ));

-- ── (2) RPC: débito atómico del wallet DEMO para una compra demo ────────────
CREATE OR REPLACE FUNCTION public.debit_demo_wallet(
  _portal_id UUID, _user_id UUID, _amount NUMERIC, _order_id UUID DEFAULT NULL, _description TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id     UUID;
  _available     NUMERIC(12,2);
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'monto invalido: %', _amount;
  END IF;

  -- Bloquea el wallet DEMO del usuario (lo crea si no existe → available 0).
  _wallet_id := public.get_or_create_user_wallet(_portal_id, _user_id, 'demo');

  SELECT available_balance INTO _available
  FROM public.portal_user_wallets
  WHERE id = _wallet_id
  FOR UPDATE;

  IF _available < _amount THEN
    RETURN 'insufficient';
  END IF;

  UPDATE public.portal_user_wallets
     SET available_balance = available_balance - _amount,
         updated_at = now()
   WHERE id = _wallet_id
  RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description, account_kind
  ) VALUES (
    _wallet_id, _portal_id, _user_id, 'demo_purchase', _amount,
    _new_pending, _new_available,
    _order_id, 'order', COALESCE(_description, 'Compra demo'), 'demo'
  );

  RETURN 'ok';
END;
$$;

-- Server-only de verdad: se quita el grant implícito a PUBLIC (que anon/authenticated
-- heredan) y se concede EXECUTE explícito solo a service_role (las edge functions).
REVOKE ALL   ON FUNCTION public.debit_demo_wallet(UUID,UUID,NUMERIC,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_demo_wallet(UUID,UUID,NUMERIC,UUID,TEXT) TO service_role;
