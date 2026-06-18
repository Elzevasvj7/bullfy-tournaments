-- ============================================================================
-- Fase 3 / P5 — balance_after del ledger atómico + normalización de currency
-- ----------------------------------------------------------------------------
-- Problema: balance_after se calculaba en las edge functions leyendo el último
-- registro (SELECT ... ORDER BY created_at DESC LIMIT 1) y sumando en memoria,
-- fuera de transacción/lock. Dos ventas concurrentes del mismo portal podían
-- leer el mismo último balance e insertar balance_after iguales, perdiendo una
-- venta del acumulado; además dependía del orden por created_at (no determinista
-- en empates).
--
-- Solución: trigger BEFORE INSERT que fija balance_after de forma AUTORITATIVA y
-- a prueba de carrera:
--   - advisory lock por portal (serializa inserts del mismo portal hasta commit);
--   - balance_after = SUMA de todos los amounts del portal + el de esta fila
--     (independiente del orden; auto-consistente / auto-sanador).
-- El valor que pase la edge function se ignora (lo sobre-escribe el trigger), así
-- que NO hace falta tocar ni redeployar las EFs: el fix es solo de BD.
--
-- También se normaliza currency del ledger a minúsculas ('usd') para que cuadre
-- con portal_payment_transactions (que ya usa 'usd') y no rompa agregaciones.
-- Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_portal_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sum NUMERIC(12,2);
BEGIN
  -- Serializa los inserts del MISMO portal hasta el commit (evita lost-update).
  PERFORM pg_advisory_xact_lock(hashtext('portal_ledger:' || NEW.portal_id::text));

  -- balance_after = acumulado de todos los movimientos del portal + este.
  -- Independiente del orden por created_at → robusto ante empates de timestamp.
  SELECT COALESCE(SUM(amount), 0) INTO _sum
  FROM public.portal_ledger
  WHERE portal_id = NEW.portal_id;

  NEW.balance_after := _sum + NEW.amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_portal_ledger_balance ON public.portal_ledger;
CREATE TRIGGER trg_set_portal_ledger_balance
  BEFORE INSERT ON public.portal_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_portal_ledger_balance();

-- ── Normalizar currency a 'usd' (cuadra con portal_payment_transactions) ──────
ALTER TABLE public.portal_ledger ALTER COLUMN currency SET DEFAULT 'usd';
UPDATE public.portal_ledger SET currency = lower(currency) WHERE currency <> lower(currency);