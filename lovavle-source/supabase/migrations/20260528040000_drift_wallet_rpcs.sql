-- ============================================================================
-- Drift recovery: tournament_wallet_credit & tournament_wallet_debit
-- ============================================================================
-- Estas dos funciones existían SOLO en la DB de producción (creadas vía SQL
-- Editor de Lovable Cloud en alguna sesión previa) y nunca habían sido
-- versionadas como migración en el repo. Eran referenciadas por múltiples
-- EFs del módulo torneos para mover BMoney y USD entre wallets de
-- participantes (acreditar premios, debitar entry fees), por lo que tenerlas
-- fuera del repo significaba que un entorno fresco no podía replicar el
-- sistema de wallet.
--
-- Las definiciones que siguen fueron extraídas directamente de producción
-- mediante `pg_get_functiondef()` el 2026-05-28 y se reproducen EXACTAS:
--   1. tournament_wallet_credit(p_user_id, p_usd, p_bmoney)
--      → suma a balance_usd / bmoney_balance del wallet, o lo crea si no existe.
--   2. tournament_wallet_debit(p_user_id, p_usd, p_bmoney, p_lock_usd, p_lock_bmoney)
--      → resta del balance verificando saldo suficiente; opcionalmente
--        bloquea el monto (mueve a locked_usd / bmoney_locked).
--
-- Idempotencia: ambos `CREATE OR REPLACE`. Aplicar esta migración en prod
-- no altera nada porque el cuerpo es idéntico al que ya está corriendo;
-- aplicarla en un entorno fresco crea las funciones desde cero. La tabla
-- subyacente `public.tournament_wallets` y sus columnas `balance_usd`,
-- `locked_usd`, `bmoney_balance`, `bmoney_locked` ya están definidas en
-- migraciones previas (20260514060422_ + 20260520002145_), por lo que
-- no hay dependencias schema-faltantes al aplicar esto.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tournament_wallet_credit(
  p_user_id uuid,
  p_usd numeric DEFAULT 0,
  p_bmoney numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE tournament_wallets
     SET balance_usd    = balance_usd + p_usd,
         bmoney_balance = bmoney_balance + p_bmoney
   WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO tournament_wallets(user_id, balance_usd, bmoney_balance)
    VALUES (p_user_id, GREATEST(0, p_usd), GREATEST(0, p_bmoney));
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tournament_wallet_debit(
  p_user_id uuid,
  p_usd numeric DEFAULT 0,
  p_bmoney numeric DEFAULT 0,
  p_lock_usd boolean DEFAULT false,
  p_lock_bmoney boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
  v_rows int;
BEGIN
  UPDATE tournament_wallets
     SET balance_usd    = CASE WHEN p_usd > 0    THEN balance_usd - p_usd       ELSE balance_usd    END,
         locked_usd     = CASE WHEN p_lock_usd    AND p_usd > 0    THEN locked_usd + p_usd          ELSE locked_usd     END,
         bmoney_balance = CASE WHEN p_bmoney > 0 THEN bmoney_balance - p_bmoney ELSE bmoney_balance END,
         bmoney_locked  = CASE WHEN p_lock_bmoney AND p_bmoney > 0 THEN bmoney_locked + p_bmoney   ELSE bmoney_locked  END
   WHERE user_id = p_user_id
     AND (p_usd    = 0 OR balance_usd    >= p_usd)
     AND (p_bmoney = 0 OR bmoney_balance >= p_bmoney);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;
