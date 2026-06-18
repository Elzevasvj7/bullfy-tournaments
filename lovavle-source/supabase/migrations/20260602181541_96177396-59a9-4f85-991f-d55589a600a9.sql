-- A) Resolver el host = IB operador (is_host y NO admin de Bullfy).
CREATE OR REPLACE FUNCTION public.get_portal_host_user_id(_portal_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pu.id
  FROM public.partner_users pu
  WHERE pu.portal_id = _portal_id
    AND pu.is_host = true
    AND NOT EXISTS (
      SELECT 1
      FROM auth.users au
      JOIN public.user_roles ur ON ur.user_id = au.id
      WHERE lower(au.email) = lower(pu.email)
        AND ur.role IN ('admin', 'global_admin')
    )
  ORDER BY pu.created_at ASC
  LIMIT 1;
$$;

-- B) Re-atribuir ingresos portal_owner mal acreditados (admin → IB operador).
DO $$
DECLARE
  c              RECORD;
  _from_wallet   uuid;
  _from_email    text;
  _is_admin      boolean;
  _correct_user  uuid;
  _to_wallet     uuid;
  _np            numeric(12,2);
  _na            numeric(12,2);
  _fp            numeric(12,2);
  _fa            numeric(12,2);
BEGIN
  FOR c IN
    SELECT pc.id, pc.portal_id, pc.amount, pc.account_kind, pc.status
    FROM public.portal_commissions pc
    WHERE pc.beneficiary_type = 'portal_owner'
      AND pc.pending_credited_at IS NOT NULL
  LOOP
    SELECT t.wallet_id INTO _from_wallet
    FROM public.portal_wallet_transactions t
    WHERE t.reference_id = c.id
      AND t.reference_type = 'portal_commission'
      AND t.transaction_type = 'portal_owner_earning'
    ORDER BY t.created_at ASC
    LIMIT 1;
    IF _from_wallet IS NULL THEN CONTINUE; END IF;

    SELECT lower(pu.email) INTO _from_email
    FROM public.portal_user_wallets w
    JOIN public.partner_users pu ON pu.id = w.user_id
    WHERE w.id = _from_wallet;

    _is_admin := EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.user_roles ur ON ur.user_id = au.id
      WHERE lower(au.email) = _from_email AND ur.role IN ('admin', 'global_admin')
    );
    IF NOT _is_admin THEN CONTINUE; END IF;

    _correct_user := public.get_portal_host_user_id(c.portal_id);
    IF _correct_user IS NULL THEN CONTINUE; END IF;
    _to_wallet := public.get_or_create_user_wallet(c.portal_id, _correct_user, COALESCE(c.account_kind, 'real'));
    IF _to_wallet = _from_wallet THEN CONTINUE; END IF;

    IF c.status = 'available' THEN
      UPDATE public.portal_user_wallets
         SET available_balance = GREATEST(0, available_balance - c.amount),
             total_earned      = GREATEST(0, total_earned - c.amount),
             updated_at = now()
       WHERE id = _from_wallet
      RETURNING pending_balance, available_balance INTO _fp, _fa;
      UPDATE public.portal_user_wallets
         SET available_balance = available_balance + c.amount,
             total_earned      = total_earned + c.amount,
             updated_at = now()
       WHERE id = _to_wallet
      RETURNING pending_balance, available_balance INTO _np, _na;
    ELSE
      UPDATE public.portal_user_wallets
         SET pending_balance = GREATEST(0, pending_balance - c.amount),
             total_earned    = GREATEST(0, total_earned - c.amount),
             updated_at = now()
       WHERE id = _from_wallet
      RETURNING pending_balance, available_balance INTO _fp, _fa;
      UPDATE public.portal_user_wallets
         SET pending_balance = pending_balance + c.amount,
             total_earned    = total_earned + c.amount,
             updated_at = now()
       WHERE id = _to_wallet
      RETURNING pending_balance, available_balance INTO _np, _na;
    END IF;

    INSERT INTO public.portal_wallet_transactions (
      wallet_id, portal_id, user_id, transaction_type, amount,
      balance_after_pending, balance_after_available,
      reference_id, reference_type, description, account_kind
    )
    SELECT _from_wallet, c.portal_id, w.user_id, 'manual_adjustment', -c.amount,
           _fp, _fa, c.id, 'portal_commission',
           'Reverso: ingreso re-atribuido al IB operador', COALESCE(c.account_kind, 'real')
    FROM public.portal_user_wallets w WHERE w.id = _from_wallet;

    INSERT INTO public.portal_wallet_transactions (
      wallet_id, portal_id, user_id, transaction_type, amount,
      balance_after_pending, balance_after_available,
      reference_id, reference_type, description, account_kind
    ) VALUES (
      _to_wallet, c.portal_id, _correct_user, 'manual_adjustment', c.amount,
      _np, _na, c.id, 'portal_commission',
      'Ingreso re-atribuido al IB operador', COALESCE(c.account_kind, 'real')
    );

    UPDATE public.portal_wallet_transactions
       SET wallet_id = _to_wallet, user_id = _correct_user
     WHERE reference_id = c.id
       AND reference_type = 'portal_commission'
       AND transaction_type IN ('portal_owner_earning', 'release_to_available');
  END LOOP;
END $$;