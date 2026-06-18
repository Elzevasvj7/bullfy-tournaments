-- ============================================================================
-- Fase 3 / P2 — Atomicidad de comisiones MLM (RPCs transaccionales)
-- ============================================================================

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
    'manual_adjustment'
  ));

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.portal_mlm_commissions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%beneficiary_type%'
  LOOP
    EXECUTE 'ALTER TABLE public.portal_mlm_commissions DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;
ALTER TABLE public.portal_mlm_commissions
  ADD CONSTRAINT portal_mlm_commissions_beneficiary_type_check
  CHECK (beneficiary_type IN ('partner_user', 'business_partner', 'portal_owner', 'platform'));

CREATE OR REPLACE FUNCTION public.get_or_create_user_wallet(_portal_id UUID, _user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id UUID;
BEGIN
  SELECT id INTO _wallet_id
  FROM public.portal_user_wallets
  WHERE portal_id = _portal_id AND user_id = _user_id;

  IF _wallet_id IS NULL THEN
    INSERT INTO public.portal_user_wallets (portal_id, user_id)
    VALUES (_portal_id, _user_id)
    ON CONFLICT (portal_id, user_id) DO NOTHING
    RETURNING id INTO _wallet_id;

    IF _wallet_id IS NULL THEN
      SELECT id INTO _wallet_id
      FROM public.portal_user_wallets
      WHERE portal_id = _portal_id AND user_id = _user_id;
    END IF;
  END IF;

  RETURN _wallet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_commission_to_wallet(
  _portal_id   UUID,
  _user_id     UUID,
  _amount      NUMERIC,
  _txn_type    TEXT,
  _reference_id UUID,
  _description TEXT,
  _metadata    JSONB DEFAULT '{}'::jsonb
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
  _wallet_id := public.get_or_create_user_wallet(_portal_id, _user_id);

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
    reference_id, reference_type, description, metadata
  ) VALUES (
    _wallet_id, _portal_id, _user_id, _txn_type, _amount,
    _new_pending, _new_available,
    _reference_id, 'mlm_commission', _description, COALESCE(_metadata, '{}'::jsonb)
  );

  RETURN _wallet_id;
END;
$$;

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
  SELECT id, portal_id, beneficiary_user_id, beneficiary_type, commission_amount, order_id
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

  _wallet_id := public.get_or_create_user_wallet(_c.portal_id, _c.beneficiary_user_id);

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
    reference_id, reference_type, description, metadata
  ) VALUES (
    _wallet_id, _c.portal_id, _c.beneficiary_user_id, 'release_to_available', _c.commission_amount,
    _new_pending, _new_available,
    _commission_id, 'mlm_commission', 'Comisión MLM liberada (refund window vencido)',
    jsonb_build_object('order_id', _c.order_id)
  );

  RETURN 'released';
END;
$$;

REVOKE ALL ON FUNCTION public.credit_commission_to_wallet(UUID,UUID,NUMERIC,TEXT,UUID,TEXT,JSONB) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_commission(UUID) FROM anon, authenticated;