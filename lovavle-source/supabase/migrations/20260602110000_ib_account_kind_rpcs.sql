-- ============================================================================
-- P7.2 — Doble contabilidad IB: RPCs con dimensión real/demo + grant admin
-- ----------------------------------------------------------------------------
-- Construye sobre P7.1 (que añadió account_kind a las tablas). Aquí:
--  1) Cambia el UNIQUE de portal_user_wallets de (portal_id,user_id) a
--     (portal_id,user_id,account_kind) → un usuario puede tener wallet REAL y
--     wallet DEMO simultáneamente.
--  2) Reescribe las 5 RPCs de dinero para que respeten account_kind:
--       - get_or_create_user_wallet: nuevo parámetro _account_kind (default 'real').
--       - credit_commission_to_wallet: nuevo parámetro _account_kind (default 'real').
--       - release_commission / refund_withdrawal / complete_withdrawal: DERIVAN el
--         kind de la fila (comisión/retiro) — firma sin cambio.
--  3) Nueva RPC admin_grant_demo_funds(...) — SOLO staff Bullfy (global_admin/admin)
--     puede inyectar fondos DEMO al wallet demo de un partner_user. Por diseño
--     NUNCA puede tocar dinero real. Con auditoría en portal_demo_fund_grants.
--
-- COMPATIBILIDAD: los parámetros nuevos llevan DEFAULT 'real', así que los callers
-- existentes (frontend anon y edge functions aún no actualizadas) siguen operando
-- exactamente igual sobre el wallet 'real'. Para evitar AMBIGÜEDAD de overload en
-- PostgREST, se DROPEA la firma vieja antes de crear la nueva (no quedan dos
-- versiones de la misma función).
--
-- Idempotente.
-- ============================================================================

-- ── (1) UNIQUE del wallet: ahora por (portal_id, user_id, account_kind) ──────
-- Dropea cualquier UNIQUE que cubra EXACTAMENTE (portal_id, user_id) y lo
-- reemplaza por la versión que incluye account_kind. Robusto ante el nombre
-- autogenerado del constraint.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.portal_user_wallets'::regclass
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attname::text)
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = k.attnum
      ) = ARRAY['portal_id','user_id']
  LOOP
    EXECUTE 'ALTER TABLE public.portal_user_wallets DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.portal_user_wallets
  DROP CONSTRAINT IF EXISTS uq_portal_user_wallets_portal_user_kind;
ALTER TABLE public.portal_user_wallets
  ADD CONSTRAINT uq_portal_user_wallets_portal_user_kind
  UNIQUE (portal_id, user_id, account_kind);

-- ── (2) get_or_create_user_wallet con _account_kind ─────────────────────────
DROP FUNCTION IF EXISTS public.get_or_create_user_wallet(UUID, UUID);
CREATE OR REPLACE FUNCTION public.get_or_create_user_wallet(
  _portal_id UUID, _user_id UUID, _account_kind TEXT DEFAULT 'real'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id UUID;
BEGIN
  IF _account_kind NOT IN ('real','demo') THEN
    RAISE EXCEPTION 'account_kind invalido: %', _account_kind;
  END IF;

  SELECT id INTO _wallet_id
  FROM public.portal_user_wallets
  WHERE portal_id = _portal_id AND user_id = _user_id AND account_kind = _account_kind;

  IF _wallet_id IS NULL THEN
    INSERT INTO public.portal_user_wallets (portal_id, user_id, account_kind)
    VALUES (_portal_id, _user_id, _account_kind)
    ON CONFLICT (portal_id, user_id, account_kind) DO NOTHING
    RETURNING id INTO _wallet_id;

    IF _wallet_id IS NULL THEN
      SELECT id INTO _wallet_id
      FROM public.portal_user_wallets
      WHERE portal_id = _portal_id AND user_id = _user_id AND account_kind = _account_kind;
    END IF;
  END IF;

  RETURN _wallet_id;
END;
$$;

-- ── (3) credit_commission_to_wallet con _account_kind ───────────────────────
DROP FUNCTION IF EXISTS public.credit_commission_to_wallet(UUID,UUID,NUMERIC,TEXT,UUID,TEXT,JSONB);
CREATE OR REPLACE FUNCTION public.credit_commission_to_wallet(
  _portal_id    UUID,
  _user_id      UUID,
  _amount       NUMERIC,
  _txn_type     TEXT,
  _reference_id UUID,
  _description  TEXT,
  _metadata     JSONB DEFAULT '{}'::jsonb,
  _account_kind TEXT  DEFAULT 'real'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id     UUID;
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  _wallet_id := public.get_or_create_user_wallet(_portal_id, _user_id, _account_kind);

  UPDATE public.portal_user_wallets
     SET pending_balance = pending_balance + _amount,
         total_earned    = total_earned + _amount,
         updated_at      = now()
   WHERE id = _wallet_id
  RETURNING pending_balance, available_balance
       INTO _new_pending, _new_available;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description, metadata, account_kind
  ) VALUES (
    _wallet_id, _portal_id, _user_id, _txn_type, _amount,
    _new_pending, _new_available,
    _reference_id, 'mlm_commission', _description, COALESCE(_metadata, '{}'::jsonb), _account_kind
  );

  RETURN _wallet_id;
END;
$$;

-- ── (4) release_commission — deriva el kind de la fila de comisión ──────────
CREATE OR REPLACE FUNCTION public.release_commission(_commission_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c             RECORD;
  _wallet_id     UUID;
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  SELECT id, portal_id, beneficiary_user_id, beneficiary_type, commission_amount, order_id, account_kind
    INTO _c
  FROM public.portal_mlm_commissions
  WHERE id = _commission_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'skipped';
  END IF;

  IF _c.beneficiary_user_id IS NULL THEN
    UPDATE public.portal_mlm_commissions SET status = 'available' WHERE id = _commission_id;
    RETURN 'marked_no_wallet';
  END IF;

  _wallet_id := public.get_or_create_user_wallet(_c.portal_id, _c.beneficiary_user_id, _c.account_kind);

  UPDATE public.portal_user_wallets
     SET pending_balance   = GREATEST(0, pending_balance - _c.commission_amount),
         available_balance = available_balance + _c.commission_amount,
         updated_at        = now()
   WHERE id = _wallet_id
  RETURNING pending_balance, available_balance
       INTO _new_pending, _new_available;

  UPDATE public.portal_mlm_commissions SET status = 'available' WHERE id = _commission_id;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description, metadata, account_kind
  ) VALUES (
    _wallet_id, _c.portal_id, _c.beneficiary_user_id, 'release_to_available', _c.commission_amount,
    _new_pending, _new_available,
    _commission_id, 'mlm_commission', 'Comisión MLM liberada (refund window vencido)',
    jsonb_build_object('order_id', _c.order_id), _c.account_kind
  );

  RETURN 'released';
END;
$$;

-- ── (5) refund_withdrawal — deriva el kind de la fila de retiro ─────────────
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
  SELECT id, portal_id, user_id, wallet_id, amount_requested, status, account_kind
    INTO _w
  FROM public.portal_withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
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
    reference_id, reference_type, description, account_kind
  ) VALUES (
    _w.wallet_id, _w.portal_id, _w.user_id, 'withdrawal_failed', _w.amount_requested,
    _new_pending, _new_available,
    _withdrawal_id, 'withdrawal', 'Reembolso por retiro fallido: ' || COALESCE(_reason, ''), _w.account_kind
  );

  RETURN 'refunded';
END;
$$;

-- ── (6) complete_withdrawal — deriva el kind de la fila de retiro ───────────
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
  SELECT id, portal_id, user_id, wallet_id, amount_net, payout_method, status, account_kind
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
    reference_id, reference_type, description, account_kind
  ) VALUES (
    _w.wallet_id, _w.portal_id, _w.user_id, 'withdrawal_completed', _w.amount_net,
    _new_pending, _new_available,
    _withdrawal_id, 'withdrawal', 'Retiro completado vía ' || COALESCE(_w.payout_method, ''), _w.account_kind
  );

  RETURN 'completed';
END;
$$;

-- ── (7) Auditoría de fondos demo otorgados por admin ────────────────────────
CREATE TABLE IF NOT EXISTS public.portal_demo_fund_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id     UUID NOT NULL,
  user_id       UUID NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  description   TEXT,
  granted_by    UUID,
  balance_after NUMERIC(12,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demo_grants_portal_user
  ON public.portal_demo_fund_grants (portal_id, user_id);

ALTER TABLE public.portal_demo_fund_grants ENABLE ROW LEVEL SECURITY;

-- Lectura solo staff Bullfy. Sin policy de escritura para anon/authenticated →
-- solo el RPC SECURITY DEFINER (o service_role) puede insertar.
DROP POLICY IF EXISTS "demo_grants: staff read" ON public.portal_demo_fund_grants;
CREATE POLICY "demo_grants: staff read" ON public.portal_demo_fund_grants
  FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.portal_demo_fund_grants TO authenticated;
GRANT ALL    ON public.portal_demo_fund_grants TO service_role;

-- ── (8) RPC: solo staff Bullfy inyecta fondos DEMO (nunca real) ─────────────
CREATE OR REPLACE FUNCTION public.admin_grant_demo_funds(
  _portal_id UUID, _user_id UUID, _amount NUMERIC, _description TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id     UUID;
  _new_pending   NUMERIC(12,2);
  _new_available NUMERIC(12,2);
BEGIN
  -- AUTORIZACIÓN: solo staff Bullfy (global_admin o admin). El partner_user (anon)
  -- jamás puede ejecutarlo (REVOKE a anon abajo + este chequeo por rol).
  IF NOT (public.is_global_admin() OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'no autorizado: se requiere rol admin o global_admin';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'monto invalido: %', _amount;
  END IF;

  -- SIEMPRE 'demo': por diseño este RPC no puede inyectar dinero real.
  _wallet_id := public.get_or_create_user_wallet(_portal_id, _user_id, 'demo');

  UPDATE public.portal_user_wallets
     SET available_balance = available_balance + _amount,
         updated_at = now()
   WHERE id = _wallet_id
  RETURNING pending_balance, available_balance INTO _new_pending, _new_available;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_type, description, metadata, account_kind
  ) VALUES (
    _wallet_id, _portal_id, _user_id, 'manual_adjustment', _amount,
    _new_pending, _new_available,
    'demo_grant', COALESCE(_description, 'Fondos demo asignados por admin'),
    jsonb_build_object('granted_by', auth.uid()), 'demo'
  );

  INSERT INTO public.portal_demo_fund_grants (portal_id, user_id, amount, description, granted_by, balance_after)
  VALUES (_portal_id, _user_id, _amount, _description, auth.uid(), _new_available);

  RETURN _new_available;
END;
$$;

-- ── (9) Permisos ────────────────────────────────────────────────────────────
-- get_or_create_user_wallet la usa el cliente (MLMClient, rol anon). Lo hacemos
-- EXPLÍCITO (no depender del EXECUTE-a-PUBLIC implícito que el DROP+CREATE podría
-- perder ante un futuro hardening).
GRANT EXECUTE ON FUNCTION public.get_or_create_user_wallet(UUID,UUID,TEXT) TO anon, authenticated;

-- RPCs server-only: solo service_role (edge functions) las invoca.
REVOKE ALL ON FUNCTION public.credit_commission_to_wallet(UUID,UUID,NUMERIC,TEXT,UUID,TEXT,JSONB,TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_commission(UUID)                 FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_withdrawal(UUID, TEXT)            FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_withdrawal(UUID, TEXT, TEXT)    FROM anon, authenticated;

-- admin_grant_demo_funds: la invoca un ADMIN autenticado (Supabase Auth) desde el
-- panel. Se quita PUBLIC (que anon/partner_user hereda) y se concede EXECUTE solo
-- a authenticated; además la autorización por rol (admin/global_admin) filtra dentro.
REVOKE ALL    ON FUNCTION public.admin_grant_demo_funds(UUID,UUID,NUMERIC,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_grant_demo_funds(UUID,UUID,NUMERIC,TEXT) TO authenticated;
