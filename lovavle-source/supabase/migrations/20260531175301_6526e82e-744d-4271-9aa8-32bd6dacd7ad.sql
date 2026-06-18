-- ============================================================================
-- C4 (defensa de servidor) — Bloquear retiros USDT mientras estén deshabilitados
-- ----------------------------------------------------------------------------
-- El bloqueo del flag USDT_WITHDRAWAL_ENABLED vive en el frontend (MLMClient).
-- Pero el INSERT en portal_withdrawal_requests y el débito del wallet se hacen
-- desde el navegador con la anon key (los partner_users no usan Supabase Auth),
-- por lo que un cliente scripteado / un bundle viejo cacheado / una llamada
-- manual puede crear un retiro USDT saltándose el frontend → solicitud en limbo
-- (processCoinsbuy es placeholder) con saldo ya debitado.
--
-- Defensa declarativa server-side: trigger BEFORE INSERT que RECHAZA cualquier
-- inserción con payout_method = 'usdt_trc20'. Como el cliente hace el débito
-- DESPUÉS del insert exitoso, rechazar el insert impide también el débito.
--
-- Además se cambia el DEFAULT de la columna a 'stripe' para que un insert que
-- omita el método no caiga por defecto en el flujo USDT deshabilitado.
--
-- REVERSIBLE: para reactivar USDT, eliminar este trigger (DROP TRIGGER
-- trg_block_usdt_withdrawal ...) y, si se desea, restaurar el default. Mantener
-- en sincronía con el flag USDT_WITHDRAWAL_ENABLED del frontend.
-- Idempotente.
-- ============================================================================

ALTER TABLE public.portal_withdrawal_requests
  ALTER COLUMN payout_method SET DEFAULT 'stripe';

CREATE OR REPLACE FUNCTION public.block_usdt_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payout_method = 'usdt_trc20' THEN
    RAISE EXCEPTION 'USDT_WITHDRAWAL_DISABLED: los retiros en USDT están temporalmente deshabilitados'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_usdt_withdrawal ON public.portal_withdrawal_requests;
CREATE TRIGGER trg_block_usdt_withdrawal
  BEFORE INSERT ON public.portal_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.block_usdt_withdrawal();
