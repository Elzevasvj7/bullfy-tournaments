-- ── Wallet unificado del IB — Fase 1 ──
-- Hace COBRABLE el ingreso del IB por sus ventas (tienda/Academy/eventos/clases).
-- Hoy la comisión 'portal_owner' en portal_commissions se queda 'pending' para siempre
-- (sin liberación ni wallet). Esta fase la acredita, tras la ventana de reembolso, al
-- wallet del HOST del portal (partner_users.is_host → portal_user_wallets), etiquetada
-- por tipo de ingreso. ADITIVO y NO destructivo: no toca MLM, finalizeOrder ni Finanzas.
--
-- Identidad: el dueño del portal tiene un registro partner_users con is_host=true (creado
-- al entrar a su panel). Ese es el user_id canónico del wallet del IB.

-- 1) Nuevo transaction_type para el ingreso del dueño (desglose por tipo en metadata).
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

-- 2) Resuelve el user_id (partner_users.id) del host/dueño de un portal.
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

-- 3) Libera las comisiones 'portal_owner' vencidas (created_at + refund_window) acreditando
--    el wallet del host. Idempotente (lock + transición pending→available). Se ejecuta por cron.
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
    -- Si el dueño aún no tiene registro host (no ha entrado a su panel), se reintenta luego.
    IF _host IS NULL THEN
      CONTINUE;
    END IF;

    _wallet := public.get_or_create_user_wallet(_c.portal_id, _host, COALESCE(_c.account_kind, 'real'));

    -- Tipo de ingreso derivado del pedido (evento / curso / membresía / asset…).
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

-- 4) Cron horario (guardado por pg_cron + idempotente).
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
