-- ============================================================================
-- COMISIONES — FASE 3 (base de datos): vendibles unificados + motor POR LÍNEA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_course_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pid uuid;
BEGIN
  SELECT id INTO _pid
  FROM public.portal_products
  WHERE portal_id = NEW.portal_id AND product_type = 'course' AND reference_id = NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF COALESCE(NEW.is_free, false) = false AND COALESCE(NEW.price_usd, 0) > 0 THEN
    IF _pid IS NULL THEN
      INSERT INTO public.portal_products (portal_id, title, description, price_usd, product_type, reference_id, status)
      VALUES (NEW.portal_id, NEW.title, NEW.description, NEW.price_usd, 'course', NEW.id, 'active')
      RETURNING id INTO _pid;
    ELSE
      UPDATE public.portal_products
         SET title = NEW.title, description = NEW.description, price_usd = NEW.price_usd,
             status = 'active', updated_at = now()
       WHERE id = _pid;
    END IF;
    UPDATE public.portal_products SET status = 'inactive', updated_at = now()
     WHERE portal_id = NEW.portal_id AND product_type = 'course' AND reference_id = NEW.id
       AND id <> _pid AND status <> 'inactive';
  ELSE
    UPDATE public.portal_products SET status = 'inactive', updated_at = now()
     WHERE portal_id = NEW.portal_id AND product_type = 'course' AND reference_id = NEW.id
       AND status <> 'inactive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_product ON public.academy_courses;
CREATE TRIGGER trg_sync_course_product
  AFTER INSERT OR UPDATE OF is_free, price_usd, title, description, status ON public.academy_courses
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_product();

DO $$
DECLARE c RECORD; _pid uuid;
BEGIN
  FOR c IN SELECT id, portal_id, title, description, price_usd, is_free FROM public.academy_courses LOOP
    SELECT id INTO _pid FROM public.portal_products
     WHERE portal_id = c.portal_id AND product_type='course' AND reference_id = c.id
     ORDER BY created_at ASC LIMIT 1;
    IF COALESCE(c.is_free,false) = false AND COALESCE(c.price_usd,0) > 0 THEN
      IF _pid IS NULL THEN
        INSERT INTO public.portal_products (portal_id, title, description, price_usd, product_type, reference_id, status)
        VALUES (c.portal_id, c.title, c.description, c.price_usd, 'course', c.id, 'active')
        RETURNING id INTO _pid;
      ELSE
        UPDATE public.portal_products SET title=c.title, description=c.description, price_usd=c.price_usd, status='active', updated_at=now() WHERE id=_pid;
      END IF;
      UPDATE public.portal_products SET status='inactive', updated_at=now()
       WHERE portal_id=c.portal_id AND product_type='course' AND reference_id=c.id AND id<>_pid AND status<>'inactive';
    ELSE
      UPDATE public.portal_products SET status='inactive', updated_at=now()
       WHERE portal_id=c.portal_id AND product_type='course' AND reference_id=c.id AND status<>'inactive';
    END IF;
  END LOOP;
END $$;

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
  _net_cap      numeric(12,2);
  _mlm_enabled  boolean;
  _active_lvls  int;
  _chain        uuid[];
  _eligible     uuid[];
  _network_paid numeric(12,2) := 0;
  _socios_pot   numeric(12,2);
  _host         uuid;
  _item         RECORD;
  _line_cap     numeric(12,2);
  _line_paid    numeric(12,2);
  _hascustom    boolean;
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
    INTO o FROM public.portal_orders WHERE id = _order_id;

  IF NOT FOUND OR o.payment_status <> 'paid' OR COALESCE(o.total_usd,0) <= 0 THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.portal_commission_lines WHERE order_id = _order_id) THEN RETURN; END IF;

  _kind   := CASE WHEN o.account_kind = 'demo' THEN 'demo' ELSE 'real' END;
  _method := CASE WHEN o.payment_gateway = 'stripe_gateway' THEN 'stripe' ELSE 'usdt' END;
  _avail  := CASE WHEN _method = 'stripe' AND _kind = 'real' THEN 'pending' ELSE 'available' END;
  _host   := public.get_portal_host_user_id(o.portal_id);
  IF _host IS NULL THEN RETURN; END IF;

  SELECT COALESCE(platform_fee_percentage,0) INTO _fee_pct FROM public.partner_portals WHERE id = o.portal_id;
  _fee_amt := round(o.total_usd * _fee_pct / 100.0, 2);
  IF _fee_amt > 0 THEN
    INSERT INTO public.portal_commission_lines (portal_id, order_id, beneficiary_user_id, beneficiary_type, source_user_id, level_number, percentage, base_amount, amount, method, status, account_kind)
    VALUES (o.portal_id, _order_id, NULL, 'platform', o.partner_user_id, NULL, _fee_pct, o.total_usd, _fee_amt, _method, 'available', _kind);
  END IF;
  _net := o.total_usd - _fee_amt;

  SELECT COALESCE(enabled,false), COALESCE(mlm_pool_percentage,0), COALESCE(active_levels,0)
    INTO _mlm_enabled, _pool_pct, _active_lvls
  FROM public.portal_mlm_config WHERE portal_id = o.portal_id;

  IF COALESCE(_mlm_enabled,false) AND COALESCE(_pool_pct,0) > 0 THEN
    SELECT upline_chain INTO _chain
    FROM public.portal_mlm_referrals
    WHERE portal_id = o.portal_id AND user_id = o.partner_user_id;

    IF _chain IS NOT NULL AND array_length(_chain,1) > 0 THEN
      SELECT array_agg(c.uid ORDER BY c.ord) INTO _eligible
      FROM (
        SELECT u.uid, u.ord
        FROM unnest(_chain) WITH ORDINALITY AS u(uid, ord)
        JOIN public.partner_users pu ON pu.id = u.uid
        WHERE pu.status NOT IN ('pending','rejected') AND COALESCE(pu.mlm_enabled,false) = true
      ) c;
    END IF;

    IF _eligible IS NOT NULL AND array_length(_eligible,1) > 0 THEN
      IF EXISTS (SELECT 1 FROM public.portal_order_items WHERE order_id = _order_id) THEN
        FOR _item IN
          SELECT product_id, round(SUM(unit_price * quantity),2)::numeric(12,2) AS line_total
          FROM public.portal_order_items WHERE order_id = _order_id GROUP BY product_id
        LOOP
          IF _item.line_total <= 0 THEN CONTINUE; END IF;
          _line_cap  := round(_item.line_total * _pool_pct / 100.0, 2);
          _line_paid := 0;
          SELECT EXISTS (
            SELECT 1 FROM public.portal_product_commission_levels
            WHERE product_id = _item.product_id AND level_number <= _active_lvls AND percentage > 0
          ) INTO _hascustom;

          FOR _lvl IN
            SELECT level_number, percentage FROM public.portal_product_commission_levels
              WHERE _hascustom AND product_id = _item.product_id AND level_number <= _active_lvls AND percentage > 0
            UNION ALL
            SELECT level_number, percentage FROM public.portal_mlm_levels
              WHERE NOT _hascustom AND portal_id = o.portal_id AND COALESCE(enabled,true) = true
                AND level_number <= _active_lvls AND percentage > 0
            ORDER BY level_number ASC
          LOOP
            _benef := _eligible[_lvl.level_number];
            CONTINUE WHEN _benef IS NULL;
            _amt := round(_item.line_total * _lvl.percentage / 100.0, 2);
            IF _amt > _line_cap - _line_paid THEN _amt := _line_cap - _line_paid; END IF;
            IF _amt > _net - _network_paid THEN _amt := _net - _network_paid; END IF;
            CONTINUE WHEN _amt <= 0;
            INSERT INTO public.portal_commission_lines (portal_id, order_id, beneficiary_user_id, beneficiary_type, source_user_id, level_number, percentage, base_amount, amount, method, status, account_kind)
            VALUES (o.portal_id, _order_id, _benef, 'network', o.partner_user_id, _lvl.level_number, _lvl.percentage, _item.line_total, _amt, _method, CASE WHEN _avail='available' THEN 'available' ELSE 'pending' END, _kind);
            PERFORM public.credit_wallet_method(o.portal_id, _benef, _kind, _method, _amt, _avail, _order_id, 'mlm_commission', 'Comisión de red nivel '||_lvl.level_number, jsonb_build_object('order_id',_order_id,'level',_lvl.level_number,'product_id',_item.product_id));
            _line_paid    := _line_paid + _amt;
            _network_paid := _network_paid + _amt;
          END LOOP;
        END LOOP;
      ELSE
        _net_cap := LEAST(round(o.total_usd * _pool_pct / 100.0, 2), _net);
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
  END IF;

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