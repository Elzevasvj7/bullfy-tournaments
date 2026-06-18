-- ============================================================================
-- P7.1 — Doble contabilidad IB: dimensión real/demo (esquema base)
-- ----------------------------------------------------------------------------
-- Introduce la dimensión `account_kind` ('real' | 'demo') en TODO el dominio de
-- dinero del IB/portal, para que Bullfy pueda dar a los IBs fondos DEMO que
-- recorran la MISMA estructura que el dinero real (órdenes → comisiones → wallet
-- → retiro), sin tocar dinero real ni la pasarela.
--
-- Modelado: discriminador POR FILA (no columnas duplicadas, no tablas separadas,
-- independiente del sistema de torneos). Cada tabla de dinero gana una columna
-- `account_kind TEXT NOT NULL DEFAULT 'real' CHECK (... IN ('real','demo'))`.
--
-- SEGURIDAD/COMPATIBILIDAD: como el DEFAULT es 'real', TODAS las filas existentes
-- quedan etiquetadas 'real' y el comportamiento del flujo real NO cambia. Esta
-- migración es puramente aditiva.
--
-- NO se cambia aún el UNIQUE de portal_user_wallets (sigue (portal_id,user_id)):
-- ese cambio va en P7.2 junto con la RPC get_or_create_user_wallet (que usa
-- ON CONFLICT (portal_id,user_id)); cambiarlo aquí rompería esa RPC. Por tanto
-- en P7.1 todavía no pueden coexistir wallet real + demo del mismo usuario; eso
-- se habilita en P7.2.
--
-- El trigger set_portal_ledger_balance SÍ se actualiza aquí para PARTICIONAR el
-- acumulado por (portal_id, account_kind). Con todas las filas en 'real' el
-- resultado es idéntico al actual; queda listo para cuando aparezcan filas demo.
--
-- Idempotente.
-- ============================================================================

-- ── 1. Añadir account_kind a cada tabla de dinero IB ─────────────────────────
-- ADD COLUMN IF NOT EXISTS es atómico por columna → re-ejecutable sin duplicar
-- el CHECK (si la columna ya existe, el ADD entero se omite).
ALTER TABLE public.portal_orders
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'real'
  CHECK (account_kind IN ('real','demo'));

ALTER TABLE public.portal_commissions
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'real'
  CHECK (account_kind IN ('real','demo'));

ALTER TABLE public.portal_mlm_commissions
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'real'
  CHECK (account_kind IN ('real','demo'));

ALTER TABLE public.portal_user_wallets
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'real'
  CHECK (account_kind IN ('real','demo'));

ALTER TABLE public.portal_wallet_transactions
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'real'
  CHECK (account_kind IN ('real','demo'));

ALTER TABLE public.portal_ledger
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'real'
  CHECK (account_kind IN ('real','demo'));

ALTER TABLE public.portal_withdrawal_requests
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'real'
  CHECK (account_kind IN ('real','demo'));

-- ── 2. Índices para filtrar por kind sin escanear toda la tabla ──────────────
CREATE INDEX IF NOT EXISTS idx_portal_orders_kind        ON public.portal_orders (portal_id, account_kind);
CREATE INDEX IF NOT EXISTS idx_portal_commissions_kind   ON public.portal_commissions (portal_id, account_kind);
CREATE INDEX IF NOT EXISTS idx_portal_mlm_comm_kind       ON public.portal_mlm_commissions (portal_id, account_kind);
CREATE INDEX IF NOT EXISTS idx_portal_wallets_kind        ON public.portal_user_wallets (portal_id, user_id, account_kind);
CREATE INDEX IF NOT EXISTS idx_portal_wallet_txn_kind     ON public.portal_wallet_transactions (portal_id, account_kind);
CREATE INDEX IF NOT EXISTS idx_portal_ledger_kind         ON public.portal_ledger (portal_id, account_kind);
CREATE INDEX IF NOT EXISTS idx_portal_withdrawals_kind    ON public.portal_withdrawal_requests (portal_id, account_kind);

-- ── 3. Trigger de balance del ledger: particionar por (portal_id, kind) ──────
-- Antes acumulaba TODOS los movimientos del portal. Ahora el saldo demo y el
-- real son acumulados SEPARADOS: el balance_after de una fila demo refleja solo
-- el acumulado demo del portal, y viceversa. El advisory lock también se separa
-- por kind para no serializar innecesariamente real vs demo.
CREATE OR REPLACE FUNCTION public.set_portal_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sum NUMERIC(12,2);
BEGIN
  -- Serializa inserts del MISMO portal y MISMO kind hasta el commit.
  PERFORM pg_advisory_xact_lock(
    hashtext('portal_ledger:' || NEW.portal_id::text || ':' || COALESCE(NEW.account_kind, 'real'))
  );

  -- Acumulado SOLO de los movimientos del mismo portal y mismo kind + este.
  SELECT COALESCE(SUM(amount), 0) INTO _sum
  FROM public.portal_ledger
  WHERE portal_id = NEW.portal_id
    AND account_kind = COALESCE(NEW.account_kind, 'real');

  NEW.balance_after := _sum + NEW.amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_portal_ledger_balance ON public.portal_ledger;
CREATE TRIGGER trg_set_portal_ledger_balance
  BEFORE INSERT ON public.portal_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_portal_ledger_balance();
