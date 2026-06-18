-- ── Visibilidad inmediata del ingreso del IB (refinamiento Fase 1) ──
ALTER TABLE public.portal_commissions
  ADD COLUMN IF NOT EXISTS pending_credited_at timestamptz;

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
  _income_type   text;
  _np            numeric(12,2);
  _na            numeric(12,2);
  _released      int := 0;
BEGIN
  FOR _c IN
    SELECT id, portal_id, amount, account_kind, order_id
    FROM public.portal_commissions
    WHERE beneficiary_type = 'portal_owner'
      AND status = 'pending'
      AND pending_credited_at IS NULL
    ORDER BY created_at ASC
    LIMIT 500
    FOR UPDATE SKIP LOCKED
  LOOP
    _host := public.get_portal_host_user_id(_c.portal_id);
    IF _host IS NULL THEN CONTINUE; END IF;

    _wallet := public.get_or_create_user_wallet(_c.portal_id, _host, COALESCE(_c.account_kind, 'real'));

    SELECT CASE
             WHEN o.event_id IS NOT NULL THEN 'event'
             ELSE COALESCE((
               SELECT pp.product_type FROM public.portal_order_items oi
               JOIN public.portal_products pp ON pp.id = oi.product_id
               WHERE oi.order_id = _c.order_id LIMIT 1
             ), 'sale')
           END
      INTO _income_type
    FROM public.portal_orders o WHERE o.id = _c.order_id;

    UPDATE public.portal_user_wallets
       SET pending_balance = pending_balance + _c.amount,
           total_earned    = total_earned + _c.amount,
           updated_at      = now()
     WHERE id = _wallet
    RETURNING pending_balance, available_balance INTO _np, _na;

    INSERT INTO public.portal_wallet_transactions (
      wallet_id, portal_id, user_id, transaction_type, amount,
      balance_after_pending, balance_after_available,
      reference_id, reference_type, description, metadata, account_kind
    ) VALUES (
      _wallet, _c.portal_id, _host, 'portal_owner_earning', _c.amount,
      _np, _na, _c.id, 'portal_commission',
      'Ingreso por venta (' || COALESCE(_income_type, 'sale') || ') — pendiente',
      jsonb_build_object('order_id', _c.order_id, 'income_type', COALESCE(_income_type, 'sale')),
      COALESCE(_c.account_kind, 'real')
    );

    UPDATE public.portal_commissions SET pending_credited_at = now() WHERE id = _c.id;
  END LOOP;

  FOR _c IN
    SELECT id, portal_id, amount, account_kind
    FROM public.portal_commissions pc
    WHERE pc.beneficiary_type = 'portal_owner'
      AND pc.status = 'pending'
      AND pc.pending_credited_at IS NOT NULL
      AND pc.created_at <= now() - (
        COALESCE((SELECT refund_window_days FROM public.portal_mlm_config WHERE portal_id = pc.portal_id), 7)
        || ' days'
      )::interval
    ORDER BY pc.created_at ASC
    LIMIT 500
    FOR UPDATE SKIP LOCKED
  LOOP
    _host := public.get_portal_host_user_id(_c.portal_id);
    IF _host IS NULL THEN CONTINUE; END IF;

    _wallet := public.get_or_create_user_wallet(_c.portal_id, _host, COALESCE(_c.account_kind, 'real'));

    UPDATE public.portal_user_wallets
       SET pending_balance   = GREATEST(0, pending_balance - _c.amount),
           available_balance = available_balance + _c.amount,
           updated_at        = now()
     WHERE id = _wallet
    RETURNING pending_balance, available_balance INTO _np, _na;

    INSERT INTO public.portal_wallet_transactions (
      wallet_id, portal_id, user_id, transaction_type, amount,
      balance_after_pending, balance_after_available,
      reference_id, reference_type, description, account_kind
    ) VALUES (
      _wallet, _c.portal_id, _host, 'release_to_available', _c.amount,
      _np, _na, _c.id, 'portal_commission',
      'Ingreso por venta liberado (ventana de reembolso vencida)',
      COALESCE(_c.account_kind, 'real')
    );

    UPDATE public.portal_commissions SET status = 'available' WHERE id = _c.id;
    _released := _released + 1;
  END LOOP;

  RETURN _released;
END;
$$;

REVOKE ALL ON FUNCTION public.release_due_portal_owner_commissions() FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-portal-owner-commissions-hourly') THEN
      PERFORM cron.unschedule('release-portal-owner-commissions-hourly');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-portal-owner-commissions') THEN
      PERFORM cron.schedule(
        'process-portal-owner-commissions',
        '*/15 * * * *',
        'SELECT public.release_due_portal_owner_commissions();'
      );
    END IF;
  END IF;
END $$;

SELECT public.release_due_portal_owner_commissions();