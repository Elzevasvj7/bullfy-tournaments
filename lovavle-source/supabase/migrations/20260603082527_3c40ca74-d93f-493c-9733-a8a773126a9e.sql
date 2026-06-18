-- ============================================================================
-- HOTFIX: reconcile_unprocessed_paid_orders no debe re-repartir órdenes que YA
-- fueron distribuidas por el sistema VIEJO (revenue-split / mlm-engine).
-- ----------------------------------------------------------------------------
-- La versión de Fase 1 reprocesaba toda orden 'paid' sin filas en
-- portal_commission_lines. Pero las órdenes históricas (anteriores al motor nuevo)
-- NO tienen filas en esa tabla y SÍ tienen sus comisiones en portal_commissions /
-- portal_mlm_commissions, y su saldo ya fue migrado al bucket. Reprocesarlas
-- acreditaría el wallet por SEGUNDA vez (doble conteo).
--
-- Fix: la reconciliación solo toma órdenes que NUNCA fueron repartidas por NINGÚN
-- sistema (sin líneas nuevas y sin comisiones viejas). Así sigue cubriendo órdenes
-- nuevas que el trigger no alcanzó (host tardío / fallo), sin tocar las históricas.
-- Idempotente.
-- ============================================================================
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
      AND COALESCE(o.total_usd,0) > 0
      AND NOT EXISTS (SELECT 1 FROM public.portal_commission_lines l WHERE l.order_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM public.portal_commissions     pc WHERE pc.order_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM public.portal_mlm_commissions  mc WHERE mc.order_id = o.id)
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