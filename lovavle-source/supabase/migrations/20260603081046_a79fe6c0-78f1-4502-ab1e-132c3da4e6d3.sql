-- ============================================================================
-- COMISIONES — FASE 1: esquema + motor único de reparto
-- ============================================================================

-- 1) CONFIG
ALTER TABLE public.partner_portals
  ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 100);

ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS mlm_enabled boolean NOT NULL DEFAULT false;

-- 2) SALDO SEGREGADO POR MÉTODO
CREATE TABLE IF NOT EXISTS public.portal_wallet_balances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         uuid NOT NULL REFERENCES public.portal_user_wallets(id) ON DELETE CASCADE,
  method            text NOT NULL CHECK (method IN ('usdt','stripe')),
  pending_balance   numeric(12,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  available_balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  total_earned      numeric(12,2) NOT NULL DEFAULT 0,
  total_withdrawn   numeric(12,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, method)
);
CREATE INDEX IF NOT EXISTS idx_portal_wallet_balances_wallet ON public.portal_wallet_balances(wallet_id);

GRANT SELECT ON public.portal_wallet_balances TO authenticated;
GRANT ALL ON public.portal_wallet_balances TO service_role;

ALTER TABLE public.portal_wallet_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_balances_select" ON public.portal_wallet_balances;
CREATE POLICY "wallet_balances_select"
  ON public.portal_wallet_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_user_wallets w
      JOIN public.partner_portals pp ON pp.id = w.portal_id
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE w.id = portal_wallet_balances.wallet_id AND p.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- 2b) AUDITORÍA
CREATE TABLE IF NOT EXISTS public.portal_commission_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id           uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  order_id            uuid NOT NULL REFERENCES public.portal_orders(id) ON DELETE CASCADE,
  beneficiary_user_id uuid REFERENCES public.partner_users(id) ON DELETE SET NULL,
  beneficiary_type    text NOT NULL CHECK (beneficiary_type IN ('platform','network','socio','ib')),
  source_user_id      uuid,
  level_number        int,
  percentage          numeric(7,4),
  base_amount         numeric(12,2) NOT NULL,
  amount              numeric(12,2) NOT NULL,
  method              text NOT NULL CHECK (method IN ('usdt','stripe')),
  status              text NOT NULL CHECK (status IN ('available','pending')),
  account_kind        text NOT NULL DEFAULT 'real' CHECK (account_kind IN ('real','demo')),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_lines_order ON public.portal_commission_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_lines_benef ON public.portal_commission_lines(portal_id, beneficiary_user_id);

GRANT SELECT ON public.portal_commission_lines TO authenticated;
GRANT ALL ON public.portal_commission_lines TO service_role;

ALTER TABLE public.portal_commission_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_lines_select" ON public.portal_commission_lines;
CREATE POLICY "commission_lines_select"
  ON public.portal_commission_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.profiles p ON p.ib_id = pp.ib_id
      WHERE pp.id = portal_commission_lines.portal_id AND p.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- 3) MIGRACIÓN DE DATOS
INSERT INTO public.portal_wallet_balances (wallet_id, method, pending_balance, available_balance, total_earned, total_withdrawn)
SELECT w.id, 'usdt', w.pending_balance, w.available_balance, w.total_earned, w.total_withdrawn
FROM public.portal_user_wallets w
ON CONFLICT (wallet_id, method) DO NOTHING;

-- 4) HELPER
CREATE OR REPLACE FUNCTION public.credit_wallet_method(
  _portal_id      uuid,
  _user_id        uuid,
  _account_kind   text,
  _method         text,
  _amount         numeric,
  _availability   text,
  _reference_id   uuid,
  _reference_type text,
  _description    text,
  _metadata       jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet   uuid;
  _to_avail numeric := CASE WHEN _availability = 'available' THEN _amount ELSE 0 END;
  _to_pend  numeric := CASE WHEN _availability = 'pending'   THEN _amount ELSE 0 END;
  _bp numeric; _ba numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 OR _user_id IS NULL THEN RETURN; END IF;

  _wallet := public.get_or_create_user_wallet(_portal_id, _user_id, COALESCE(_account_kind,'real'));

  INSERT INTO public.portal_wallet_balances (wallet_id, method, pending_balance, available_balance, total_earned)
  VALUES (_wallet, _method, _to_pend, _to_avail, _amount)
  ON CONFLICT (wallet_id, method) DO UPDATE
     SET pending_balance   = public.portal_wallet_balances.pending_balance   + EXCLUDED.pending_balance,
         available_balance = public.portal_wallet_balances.available_balance + EXCLUDED.available_balance,
         total_earned      = public.portal_wallet_balances.total_earned      + EXCLUDED.total_earned,
         updated_at = now();

  UPDATE public.portal_user_wallets
     SET pending_balance   = pending_balance   + _to_pend,
         available_balance = available_balance + _to_avail,
         total_earned      = total_earned      + _amount,
         updated_at = now()
   WHERE id = _wallet
  RETURNING pending_balance, available_balance INTO _bp, _ba;

  INSERT INTO public.portal_wallet_transactions (
    wallet_id, portal_id, user_id, transaction_type, amount,
    balance_after_pending, balance_after_available,
    reference_id, reference_type, description, metadata, account_kind
  ) VALUES (
    _wallet, _portal_id, _user_id,
    CASE WHEN _availability = 'available' THEN 'release_to_available' ELSE 'commission_pending' END,
    _amount, _bp, _ba, _reference_id, _reference_type, _description,
    COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('method', _method), COALESCE(_account_kind,'real')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.credit_wallet_method(uuid,uuid,text,text,numeric,text,uuid,text,text,jsonb) FROM PUBLIC;

-- 5) MOTOR ÚNICO
CREATE OR REPLACE FUNCTION public.distribute_order_commissions(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o             RECORD;
  _method       text;
  _avail        text;
  _kind         text;
  _fee_pct      numeric(7,4);
  _fee_amt      numeric(12,2);
  _net          numeric(12,2);
  _pool_pct     numeric(7,4);
  _pool_amt     numeric(12,2);
  _net_cap      numeric(12,2);
  _mlm_enabled  boolean;
  _active_lvls  int;
  _chain        uuid[];
  _eligible     uuid[];
  _network_paid numeric(12,2) := 0;
  _socios_pot   numeric(12,2);
  _host         uuid;
  _lvl          RECORD;
  _benef        uuid;
  _amt          numeric(12,2);
  _socio        RECORD;
  _sum_w        numeric(12,4) := 0;
  _total_w      numeric(12,4) := 0;
  _assigned     numeric(12,2) := 0;
  _ib_pct       numeric(7,4);
BEGIN
  SELECT id, portal_id, partner_user_id, total_usd, payment_status, payment_gateway, account_kind
    INTO o
  FROM public.portal_orders WHERE id = _order_id;

  IF NOT FOUND OR o.payment_status <> 'paid' OR COALESCE(o.total_usd,0) <= 0 THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.portal_commission_lines WHERE order_id = _order_id) THEN RETURN; END IF;

  _kind   := CASE WHEN o.account_kind = 'demo' THEN 'demo' ELSE 'real' END;
  _method := CASE WHEN o.payment_gateway = 'stripe_gateway' THEN 'stripe' ELSE 'usdt' END;
  _avail  := CASE WHEN _method = 'stripe' AND _kind = 'real' THEN 'pending' ELSE 'available' END;
  _host   := public.get_portal_host_user_id(o.portal_id);

  IF _host IS NULL THEN RETURN; END IF;

  -- (a) Platform fee
  SELECT COALESCE(platform_fee_percentage,0) INTO _fee_pct FROM public.partner_portals WHERE id = o.portal_id;
  _fee_amt := round(o.total_usd * _fee_pct / 100.0, 2);
  IF _fee_amt > 0 THEN
    INSERT INTO public.portal_commission_lines (portal_id, order_id, beneficiary_user_id, beneficiary_type, source_user_id, level_number, percentage, base_amount, amount, method, status, account_kind)
    VALUES (o.portal_id, _order_id, NULL, 'platform', o.partner_user_id, NULL, _fee_pct, o.total_usd, _fee_amt, _method, 'available', _kind);
  END IF;
  _net := o.total_usd - _fee_amt;

  -- (b) Pool de red con compresión
  SELECT COALESCE(enabled,false), COALESCE(mlm_pool_percentage,0), COALESCE(active_levels,0)
    INTO _mlm_enabled, _pool_pct, _active_lvls
  FROM public.portal_mlm_config WHERE portal_id = o.portal_id;

  IF COALESCE(_mlm_enabled,false) AND COALESCE(_pool_pct,0) > 0 THEN
    _pool_amt := round(o.total_usd * _pool_pct / 100.0, 2);
    _net_cap  := LEAST(_pool_amt, _net);

    SELECT upline_chain INTO _chain
    FROM public.portal_mlm_referrals
    WHERE portal_id = o.portal_id AND user_id = o.partner_user_id;

    IF _chain IS NOT NULL AND array_length(_chain,1) > 0 THEN
      SELECT array_agg(c.uid ORDER BY c.ord) INTO _eligible
      FROM (
        SELECT u.uid, u.ord
        FROM unnest(_chain) WITH ORDINALITY AS u(uid, ord)
        JOIN public.partner_users pu ON pu.id = u.uid
        WHERE pu.status NOT IN ('pending','rejected')
          AND COALESCE(pu.mlm_enabled,false) = true
      ) c;
    END IF;

    IF _eligible IS NOT NULL AND array_length(_eligible,1) > 0 THEN
      FOR _lvl IN
        SELECT level_number, percentage FROM public.portal_mlm_levels
        WHERE portal_id = o.portal_id AND COALESCE(enabled,true) = true
          AND level_number <= _active_lvls AND percentage > 0
        ORDER BY level_number ASC
      LOOP
        _benef := _eligible[_lvl.level_number];
        CONTINUE WHEN _benef IS NULL;
        _amt := round(o.total_usd * _lvl.percentage / 100.0, 2);
        IF _amt > _net_cap - _network_paid THEN _amt := _net_cap - _network_paid; END IF;
        CONTINUE WHEN _amt <= 0;
        INSERT INTO public.portal_commission_lines (portal_id, order_id, beneficiary_user_id, beneficiary_type, source_user_id, level_number, percentage, base_amount, amount, method, status, account_kind)
        VALUES (o.portal_id, _order_id, _benef, 'network', o.partner_user_id, _lvl.level_number, _lvl.percentage, o.total_usd, _amt, _method, CASE WHEN _avail='available' THEN 'available' ELSE 'pending' END, _kind);
        PERFORM public.credit_wallet_method(o.portal_id, _benef, _kind, _method, _amt, _avail, _order_id, 'mlm_commission', 'Comisión de red nivel '||_lvl.level_number, jsonb_build_object('order_id',_order_id,'level',_lvl.level_number));
        _network_paid := _network_paid + _amt;
      END LOOP;
    END IF;
  END IF;

  -- (c) Socios (incluye al IB)
  _socios_pot := GREATEST(_net - _network_paid, 0);

  IF _socios_pot > 0 AND _host IS NOT NULL THEN
    SELECT COALESCE(SUM(bp.percentage),0) INTO _sum_w
    FROM public.portal_business_partners bp
    JOIN public.partner_users pu ON pu.id = bp.partner_user_id
    WHERE bp.portal_id = o.portal_id AND bp.active = true
      AND COALESCE(pu.can_be_business_partner,false) = true
      AND bp.partner_user_id <> _host;

    SELECT bp.percentage INTO _ib_pct
    FROM public.portal_business_partners bp
    WHERE bp.portal_id = o.portal_id AND bp.active = true AND bp.partner_user_id = _host
    LIMIT 1;
    IF _ib_pct IS NULL THEN
      _ib_pct := GREATEST(100.0 - COALESCE(_fee_pct,0) - COALESCE(_pool_pct,0) - _sum_w, 0);
    END IF;
    _total_w := _sum_w + COALESCE(_ib_pct,0);

    IF _total_w > 0 THEN
      FOR _socio IN
        SELECT bp.partner_user_id AS user_id, bp.percentage AS pct
        FROM public.portal_business_partners bp
        JOIN public.partner_users pu ON pu.id = bp.partner_user_id
        WHERE bp.portal_id = o.portal_id AND bp.active = true
          AND COALESCE(pu.can_be_business_partner,false) = true
          AND bp.partner_user_id <> _host
      LOOP
        _amt := round(_socios_pot * _socio.pct / _total_w, 2);
        CONTINUE WHEN _amt <= 0;
        INSERT INTO public.portal_commission_lines (portal_id, order_id, beneficiary_user_id, beneficiary_type, source_user_id, level_number, percentage, base_amount, amount, method, status, account_kind)
        VALUES (o.portal_id, _order_id, _socio.user_id, 'socio', o.partner_user_id, NULL, _socio.pct, o.total_usd, _amt, _method, CASE WHEN _avail='available' THEN 'available' ELSE 'pending' END, _kind);
        PERFORM public.credit_wallet_method(o.portal_id, _socio.user_id, _kind, _method, _amt, _avail, _order_id, 'socio_share', 'Participación de socio', jsonb_build_object('order_id',_order_id));
        _assigned := _assigned + _amt;
      END LOOP;
    END IF;

    _amt := _socios_pot - _assigned;
    IF _amt > 0 THEN
      INSERT INTO public.portal_commission_lines (portal_id, order_id, beneficiary_user_id, beneficiary_type, source_user_id, level_number, percentage, base_amount, amount, method, status, account_kind)
      VALUES (o.portal_id, _order_id, _host, 'ib', o.partner_user_id, NULL, _ib_pct, o.total_usd, _amt, _method, CASE WHEN _avail='available' THEN 'available' ELSE 'pending' END, _kind);
      PERFORM public.credit_wallet_method(o.portal_id, _host, _kind, _method, _amt, _avail, _order_id, 'ib_share', 'Ingreso del IB', jsonb_build_object('order_id',_order_id));
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.distribute_order_commissions(uuid) FROM PUBLIC;

-- 6) TRIGGER ÚNICO
CREATE OR REPLACE FUNCTION public.trg_distribute_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    PERFORM public.distribute_order_commissions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mlm_engine_on_paid_order ON public.portal_orders;
DROP TRIGGER IF EXISTS trg_mlm_engine_on_paid_insert ON public.portal_orders;

DROP TRIGGER IF EXISTS trg_distribute_on_paid_update ON public.portal_orders;
CREATE TRIGGER trg_distribute_on_paid_update
  AFTER UPDATE OF payment_status ON public.portal_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_distribute_on_paid();

DROP TRIGGER IF EXISTS trg_distribute_on_paid_insert ON public.portal_orders;
CREATE TRIGGER trg_distribute_on_paid_insert
  AFTER INSERT ON public.portal_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_distribute_on_paid();

-- 7) DESACTIVAR caminos viejos
CREATE OR REPLACE FUNCTION public.release_due_portal_owner_commissions()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 0;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_unprocessed_paid_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r RECORD; _n int := 0;
BEGIN
  FOR _r IN
    SELECT o.id
    FROM public.portal_orders o
    WHERE o.payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM public.portal_commission_lines l WHERE l.order_id = o.id)
      AND public.get_portal_host_user_id(o.portal_id) IS NOT NULL
    ORDER BY o.created_at ASC
    LIMIT 500
  LOOP
    PERFORM public.distribute_order_commissions(_r.id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_unprocessed_paid_orders() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mlm-release-commissions-hourly') THEN
      PERFORM cron.unschedule('mlm-release-commissions-hourly');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-portal-owner-commissions-hourly') THEN
      PERFORM cron.unschedule('release-portal-owner-commissions-hourly');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-portal-owner-commissions') THEN
      PERFORM cron.unschedule('process-portal-owner-commissions');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-commission-distribution-hourly') THEN
      PERFORM cron.schedule('reconcile-commission-distribution-hourly', '20 * * * *',
        'SELECT public.reconcile_unprocessed_paid_orders();');
    END IF;
  END IF;
END $$;