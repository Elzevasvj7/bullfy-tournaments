-- ============================================================================
-- LIMPIEZA: revertir el doble crédito del cron de reconciliación
-- ----------------------------------------------------------------------------
-- Antes del hotfix 20260603090000, el cron reconcile-commission-distribution-hourly
-- reprocesó órdenes 'paid' HISTÓRICAS (de prueba), cuyo saldo ya había sido migrado
-- al bucket. Eso creó filas en portal_commission_lines y ACREDITÓ los wallets por
-- segunda vez (bucket + agregado legacy). Como portal_commission_lines estaba VACÍA
-- antes y NO hubo compras nuevas, TODAS sus filas actuales son ese crédito erróneo.
--
-- Esta migración:
--   1) Revierte el crédito en portal_wallet_balances (bucket) por wallet/método/estado.
--   2) Revierte el crédito en el agregado legacy portal_user_wallets.
--   3) Borra los asientos de portal_wallet_transactions creados por ese reparto.
--   4) Borra las filas erróneas de portal_commission_lines.
-- Tras esto, los wallets quedan en el saldo REAL migrado (lo único real: NOWPayments).
--
-- ⚠️ Asume que NO hubo órdenes legítimas nuevas (verificado: la tabla estaba vacía y
-- no hubo compras). Si se hicieran compras reales antes de aplicar esto, NO aplicar.
-- ============================================================================

-- 1) Revertir bucket (por wallet + método + estado available/pending).
WITH rev AS (
  SELECT w.id AS wallet_id, l.method,
         SUM(CASE WHEN l.status = 'available' THEN l.amount ELSE 0 END) AS av,
         SUM(CASE WHEN l.status = 'pending'   THEN l.amount ELSE 0 END) AS pe,
         SUM(l.amount) AS te
  FROM public.portal_commission_lines l
  JOIN public.portal_user_wallets w
    ON w.portal_id = l.portal_id
   AND w.user_id   = l.beneficiary_user_id
   AND w.account_kind = l.account_kind
  WHERE l.beneficiary_user_id IS NOT NULL
  GROUP BY w.id, l.method
)
UPDATE public.portal_wallet_balances b
   SET available_balance = GREATEST(b.available_balance - rev.av, 0),
       pending_balance   = GREATEST(b.pending_balance   - rev.pe, 0),
       total_earned      = GREATEST(b.total_earned      - rev.te, 0),
       updated_at = now()
  FROM rev
 WHERE b.wallet_id = rev.wallet_id AND b.method = rev.method;

-- 2) Revertir el agregado legacy.
WITH rev AS (
  SELECT w.id AS wallet_id,
         SUM(CASE WHEN l.status = 'available' THEN l.amount ELSE 0 END) AS av,
         SUM(CASE WHEN l.status = 'pending'   THEN l.amount ELSE 0 END) AS pe,
         SUM(l.amount) AS te
  FROM public.portal_commission_lines l
  JOIN public.portal_user_wallets w
    ON w.portal_id = l.portal_id
   AND w.user_id   = l.beneficiary_user_id
   AND w.account_kind = l.account_kind
  WHERE l.beneficiary_user_id IS NOT NULL
  GROUP BY w.id
)
UPDATE public.portal_user_wallets w
   SET available_balance = GREATEST(w.available_balance - rev.av, 0),
       pending_balance   = GREATEST(w.pending_balance   - rev.pe, 0),
       total_earned      = GREATEST(w.total_earned      - rev.te, 0),
       updated_at = now()
  FROM rev
 WHERE w.id = rev.wallet_id;

-- 3) Borrar los asientos de auditoría creados por ese reparto erróneo.
DELETE FROM public.portal_wallet_transactions
 WHERE reference_type IN ('mlm_commission','socio_share','ib_share')
   AND reference_id IN (SELECT DISTINCT order_id FROM public.portal_commission_lines);

-- 4) Borrar las líneas erróneas.
DELETE FROM public.portal_commission_lines;