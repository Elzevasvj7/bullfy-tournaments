-- ============================================================================
-- Fase 3 / P3 (hardening) — Integridad de retiros y wallets
-- ----------------------------------------------------------------------------
-- NO incluye el flujo de creación de retiro desde el cliente (ese requiere la
-- capa de sesión de servidor — Fase 2 — porque partner_users son anon y no se
-- puede verificar identidad sin sesión). Aquí solo: arreglar el procesamiento,
-- hacerlo atómico, y blindar las tablas de dinero.
--
-- Incluye:
--  1) CHECK available_balance/pending_balance >= 0 (NOT VALID: aplica a writes
--     nuevos sin fallar por datos preexistentes).
--  2) RPC refund_withdrawal — reembolso atómico (marca failed + reintegra saldo
--     + asiento de ledger correcto) en una transacción. Reemplaza el insert de
--     ledger ROTO de la edge function (usaba columna `type` inexistente y un
--     transaction_type fuera del CHECK → todos los asientos de retiro fallaban).
--  3) RPC complete_withdrawal — completado atómico (total_withdrawn += net +
--     ledger + marca completed).
--  4) REVOKE EXECUTE de los nuevos RPCs a anon/authenticated (solo la EF los usa).
--     (El REVOKE de los grants de escritura amplios sobre las tablas de dinero se
--     DIFIERE a Fase 2, con el rediseño del write del cliente — ver nota abajo.)
--  5) ENABLE RLS idempotente.
-- Idempotente.
-- ============================================================================

-- ── (1) CHECK de no-negatividad ──────────────────────────────────────────────
ALTER TABLE public.portal_user_wallets DROP CONSTRAINT IF EXISTS chk_puw_available_nonneg;
ALTER TABLE public.portal_user_wallets
  ADD CONSTRAINT chk_puw_available_nonneg CHECK (available_balance >= 0) NOT VALID;
ALTER TABLE public.portal_user_wallets DROP CONSTRAINT IF EXISTS chk_puw_pending_nonneg;
ALTER TABLE public.portal_user_wallets
  ADD CONSTRAINT chk_puw_pending_nonneg CHECK (pending_balance >= 0) NOT VALID;

-- ── (2) RPC: reembolso atómico de un retiro fallido ──────────────────────────
CREATE OR REPLACE FUNCTION public.refund_withdrawal(_withdrawal_id UUID, _reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _w             RECORD;
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  SELECT id, portal_id, user_id, wallet_id, amount_requested, status
    INTO _w
  FROM public.portal_withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  -- Idempotente: solo reembolsa si está pendiente o en proceso.
  IF _w.status NOT IN ('pending', 'processing') THEN RETURN 'skipped'; END IF;

  UPDATE public.portal_withdrawal_requests
     SET status = 'failed', failure_reason = _reason, updated_at = now()
   WHERE id = _withdrawal_id;

  UPDATE public.portal_user_wallets
     SET available_balance = available_balance + _w.amount_requested,
         updated_at = now()
   WHERE id = _w.wallet_id
  RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description
  ) VALUES (
    _w.wallet_id, _w.portal_id, _w.user_id, 'withdrawal_failed', _w.amount_requested,
    _new_pending, _new_available,
    _withdrawal_id, 'withdrawal', 'Reembolso por retiro fallido: ' || COALESCE(_reason, '')
  );

  RETURN 'refunded';
END;
$$;

-- ── (3) RPC: completar un retiro de forma atómica ────────────────────────────
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
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  SELECT id, portal_id, user_id, wallet_id, amount_net, payout_method, status
    INTO _w
  FROM public.portal_withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF _w.status = 'completed' THEN RETURN 'skipped'; END IF;

  UPDATE public.portal_withdrawal_requests
     SET status = 'completed', completed_at = now(), updated_at = now(),
         coinsbuy_payout_id = COALESCE(_payout_id, coinsbuy_payout_id),
         coinsbuy_tx_hash   = COALESCE(_tx_hash, coinsbuy_tx_hash)
   WHERE id = _withdrawal_id;

  UPDATE public.portal_user_wallets
     SET total_withdrawn = total_withdrawn + _w.amount_net,
         updated_at = now()
   WHERE id = _w.wallet_id
  RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description
  ) VALUES (
    _w.wallet_id, _w.portal_id, _w.user_id, 'withdrawal_completed', _w.amount_net,
    _new_pending, _new_available,
    _withdrawal_id, 'withdrawal', 'Retiro completado vía ' || COALESCE(_w.payout_method, '')
  );

  RETURN 'completed';
END;
$$;

-- ── (4) REVOKE EXECUTE de los nuevos RPCs (solo los invoca la EF service_role)
-- NOTA: el REVOKE de los grants de escritura amplios (INSERT/UPDATE/DELETE) sobre
-- portal_user_wallets / _wallet_transactions / _withdrawal_requests se DIFIERE a
-- la Fase 2, junto con el rediseño del write del cliente (capa de sesión). Hoy
-- RLS ya bloquea esas escrituras (solo hay policies SELECT), así que el grant
-- amplio es inerte; revocarlo aquí —fuera del rediseño del flujo— arriesgaría
-- romper el guardado de wallet/destino del cliente sin cerrarlo correctamente.
REVOKE ALL ON FUNCTION public.refund_withdrawal(UUID, TEXT)         FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_withdrawal(UUID, TEXT, TEXT) FROM anon, authenticated;

-- ── (5) Asegurar RLS activo (idempotente) ────────────────────────────────────
ALTER TABLE public.portal_user_wallets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_withdrawal_requests ENABLE ROW LEVEL SECURITY;