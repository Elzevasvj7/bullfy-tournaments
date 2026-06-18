-- ============================================================================
-- Fase 3 / P4a — Deduplicación de comisiones de revenue split
-- ----------------------------------------------------------------------------
-- portal_commissions (comisiones de revenue split: platform/portal_owner/
-- referrer por orden) no tenía UNIQUE(order_id, beneficiary_type), y la ruta de
-- verify_payment (polling Coinsbuy) podía insertar comisiones duplicadas bajo
-- concurrencia (el UPDATE a 'paid' no era condicional). Esto añade la restricción
-- de unicidad para que los inserts puedan usar onConflict-ignore y nunca dupliquen.
--
-- Primero deduplica filas existentes (conserva una por (order_id,beneficiary_type),
-- la de menor ctid) y luego crea el índice único.
-- Idempotente.
-- ============================================================================

-- Deduplicar filas existentes (si las hubiera por la carrera previa).
DELETE FROM public.portal_commissions a
USING public.portal_commissions b
WHERE a.order_id = b.order_id
  AND a.beneficiary_type = b.beneficiary_type
  AND a.order_id IS NOT NULL
  AND a.ctid > b.ctid;

-- Unicidad por (orden, beneficiario): habilita onConflict-ignore en los inserts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_commissions_order_beneficiary
  ON public.portal_commissions (order_id, beneficiary_type);