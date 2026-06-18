-- ============================================================================
-- PR #7 — Bombas financieras: enum + RLS + RPCs atómicas + trigger
-- Cubre hallazgos de auditoría: A1, A3, A4, A5, C4, C8, C9, C10
-- ============================================================================
-- NOTA: ALTER TYPE ... ADD VALUE no puede correr dentro de una transacción.
-- Supabase ejecuta cada statement en autocommit en el editor de SQL, así que
-- esta migración funciona tal cual al aplicarla por dashboard. Si en el futuro
-- corres este archivo vía supabase CLI con tx envuelta, separa los dos
-- ALTER TYPE en una migración previa propia.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A3 + A4: enums faltantes en tournament_payment_type
-- ----------------------------------------------------------------------------
-- Sin estos valores, los INSERT de tournament_payments en clan-verify y
-- user-verify-request fallan silenciosamente (el código destructura solo
-- `data`, no `error`), dejando el wallet debitado sin audit trail.
-- ----------------------------------------------------------------------------
ALTER TYPE public.tournament_payment_type ADD VALUE IF NOT EXISTS 'clan_verify';
ALTER TYPE public.tournament_payment_type ADD VALUE IF NOT EXISTS 'user_verify';


-- ----------------------------------------------------------------------------
-- A5: revocar SELECT sobre invite_code de tournament_clans
-- ----------------------------------------------------------------------------
-- La policy `clans_public_read` con USING (true) permite a cualquiera con
-- anon key leer todos los invite_code, bypaseando el flujo de invitación.
-- Postgres soporta privilegios a nivel de columna: revocando SELECT(invite_code)
-- a anon/authenticated, el campo queda inaccesible para clientes web pero las
-- Edge Functions con service_role lo siguen viendo.
-- IMPACTO FRONTEND: `select("*")` y `.eq("invite_code", X)` con anon key
-- devuelven error "permission denied for column invite_code".
-- Mitigación: TournamentClanDetail.tsx pasa a usar columnas explícitas y
-- delega la lectura del código a tournament-clan-get-invite-code (con
-- validación de membresía); la búsqueda por código para retar usa
-- tournament-clan-war-challenge con `defender_invite_code`.
-- ----------------------------------------------------------------------------
REVOKE SELECT (invite_code) ON public.tournament_clans FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- C4 + A1: tournament_wallet_unlock(p_user_id, p_usd)
-- ----------------------------------------------------------------------------
-- Devuelve fondos lockeados al balance disponible en una sola instrucción
-- SQL atómica. Reemplaza el patrón select → calcular → update que sufría de
-- race conditions cuando otra operación tocaba el wallet entre el SELECT y
-- el UPDATE.
-- Llamada desde: versus-create (rollback si falla INSERT), clan-war-respond
-- (rollback si falla creación de torneo), trigger automático on clan war
-- pending → rejected/expired.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_wallet_unlock(
  p_user_id uuid,
  p_usd numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_usd IS NULL OR p_usd <= 0 THEN
    RETURN true;
  END IF;

  -- Nota: ambas expresiones SET evalúan contra el valor PRE-update (locked_usd
  -- referencia el valor antiguo en ambas líneas). Por eso balance solo gana
  -- LEAST(p_usd, locked_usd): si locked está por debajo de p_usd (caso
  -- degenerado, ej. doble-fire del trigger o admin manual), el credit nunca
  -- excede los fondos efectivamente lockeados. Defensa en profundidad contra
  -- "imprimir dinero" desde unlock.
  UPDATE public.tournament_wallets
  SET
    locked_usd  = GREATEST(0::numeric, locked_usd - p_usd),
    balance_usd = balance_usd + LEAST(p_usd, locked_usd)
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_wallet_unlock(uuid, numeric) TO service_role;


-- ----------------------------------------------------------------------------
-- A1: tournament_wallet_consume_locked(p_user_id, p_usd)
-- ----------------------------------------------------------------------------
-- Decrementa `locked_usd` sin acreditar `balance_usd`. Se usa en settlement
-- de clan wars: el stake lockeado del payer perdedor (y del payer ganador,
-- que recibe su crédito por separado como parte del pot) se "consume" del
-- locked y desaparece del wallet. Eso es lo que diferencia consume_locked
-- de wallet_unlock — este último devuelve los fondos al balance.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_wallet_consume_locked(
  p_user_id uuid,
  p_usd numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_usd IS NULL OR p_usd <= 0 THEN
    RETURN true;
  END IF;

  UPDATE public.tournament_wallets
  SET locked_usd = GREATEST(0::numeric, locked_usd - p_usd)
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_wallet_consume_locked(uuid, numeric) TO service_role;


-- ----------------------------------------------------------------------------
-- A1: trigger que desbloquea stake del challenger en cierres no-settle
-- ----------------------------------------------------------------------------
-- Si un clan war pasa de 'pending' a 'rejected' o 'expired' (por deadline,
-- por rechazo manual del defender, o por cron de expiración), el stake
-- lockeado del challenger debe devolverse a su balance disponible.
-- Centralizando esto en un trigger, no importa por qué camino se cierre el
-- reto: el unlock siempre ocurre.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_clan_war_unlock_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending'
     AND NEW.status IN ('rejected', 'expired')
     AND COALESCE(NEW.stake_usd, 0) > 0
  THEN
    PERFORM public.tournament_wallet_unlock(NEW.created_by_user_id, NEW.stake_usd);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_clan_war_unlock_trigger ON public.tournament_clan_wars;

CREATE TRIGGER tournament_clan_war_unlock_trigger
  AFTER UPDATE OF status ON public.tournament_clan_wars
  FOR EACH ROW
  EXECUTE FUNCTION public.tournament_clan_war_unlock_on_close();


-- ----------------------------------------------------------------------------
-- C8: tournament_redeem_atomic
-- ----------------------------------------------------------------------------
-- Encapsula todo el flujo de canje de Bullfy Points en una transacción con
-- locks de fila explícitos, neutralizando las 3 race conditions del Edge
-- Function actual:
--   1. Deducción de puntos parte de un valor cacheado al inicio del request
--      → dos clicks paralelos canjeaban gratis al actualizar al mismo valor.
--   2. Rollback escribía el valor inicial → podía pisar cambios intermedios.
--   3. Stock decrement read-modify-write → podía quedar negativo.
-- Lanza excepciones con códigos claros (`out_of_stock`, `insufficient_points`,
-- `item_not_found_or_inactive`, `user_not_found`) que el Edge Function mapea
-- a respuestas user-friendly.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_redeem_atomic(
  p_user_id    uuid,
  p_catalog_id uuid,
  p_code       text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item          public.tournament_redemption_catalog%ROWTYPE;
  v_user_points   integer;
  v_redemption_id uuid;
BEGIN
  -- Lock fila del catálogo (FOR UPDATE) — evita race en stock.
  SELECT * INTO v_item
  FROM public.tournament_redemption_catalog
  WHERE id = p_catalog_id AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found_or_inactive';
  END IF;

  IF v_item.stock IS NOT NULL AND v_item.stock <= 0 THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  -- Lock fila del usuario — evita race en puntos.
  SELECT bullfy_points INTO v_user_points
  FROM public.tournament_users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_user_points < v_item.cost_points THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  -- Decrement stock (solo si el ítem tiene stock finito).
  IF v_item.stock IS NOT NULL THEN
    UPDATE public.tournament_redemption_catalog
    SET stock = stock - 1
    WHERE id = p_catalog_id;
  END IF;

  -- Decrement puntos.
  UPDATE public.tournament_users
  SET bullfy_points = bullfy_points - v_item.cost_points
  WHERE id = p_user_id;

  -- Insert redemption code.
  INSERT INTO public.tournament_redemption_codes (
    user_id, catalog_id, code, expires_at, cost_points, payload
  )
  VALUES (
    p_user_id, p_catalog_id, p_code, p_expires_at,
    v_item.cost_points, COALESCE(v_item.payload, '{}'::jsonb)
  )
  RETURNING id INTO v_redemption_id;

  -- Insert ledger entry asociado al redemption.
  INSERT INTO public.tournament_points_ledger (
    user_id, delta, reason, redemption_code_id, metadata
  )
  VALUES (
    p_user_id, -v_item.cost_points, 'redeem', v_redemption_id,
    jsonb_build_object('catalog_id', p_catalog_id, 'name', v_item.name)
  );

  RETURN jsonb_build_object(
    'id',         v_redemption_id,
    'code',       p_code,
    'expires_at', p_expires_at,
    'item',       jsonb_build_object('name', v_item.name, 'kind', v_item.kind)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_redeem_atomic(uuid, uuid, text, timestamptz) TO service_role;


-- ----------------------------------------------------------------------------
-- C9: tournament_clan_create_atomic
-- ----------------------------------------------------------------------------
-- Inserta el clan y la membership del owner en una sola transacción.
-- Sin esto, si el segundo INSERT falla (constraint, etc.), queda un clan
-- huérfano sin owner en tournament_clan_members aunque tournament_clans.
-- owner_id apunte al user.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_clan_create_atomic(
  p_owner_id    uuid,
  p_name        text,
  p_tag         text,
  p_description text,
  p_logo_url    text,
  p_banner_url  text,
  p_is_public   boolean,
  p_invite_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clan public.tournament_clans%ROWTYPE;
BEGIN
  INSERT INTO public.tournament_clans (
    name, tag, description, logo_url, banner_url,
    owner_id, invite_code, is_public
  )
  VALUES (
    p_name, p_tag, p_description, p_logo_url, p_banner_url,
    p_owner_id, p_invite_code, p_is_public
  )
  RETURNING * INTO v_clan;

  INSERT INTO public.tournament_clan_members (
    clan_id, user_id, role
  )
  VALUES (
    v_clan.id, p_owner_id, 'owner'
  );

  RETURN to_jsonb(v_clan);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_clan_create_atomic(
  uuid, text, text, text, text, text, boolean, text
) TO service_role;


-- ----------------------------------------------------------------------------
-- C10: tournament_clan_transfer_owner
-- ----------------------------------------------------------------------------
-- Demote viejo owner + Promote nuevo + sync owner_id en tournament_clans,
-- todo en una transacción. Sin esto, un fallo a mitad deja el clan sin owner
-- (si falla el segundo UPDATE) o con dos owners + owner_id desincronizado
-- (si falla el tercero).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_clan_transfer_owner(
  p_clan_id      uuid,
  p_old_owner_id uuid,
  p_new_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role text;
BEGIN
  -- Verificar que el viejo owner es de hecho el owner actual y lockear su row.
  SELECT role INTO v_old_role
  FROM public.tournament_clan_members
  WHERE clan_id = p_clan_id
    AND user_id = p_old_owner_id
    AND left_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_old_role <> 'owner' THEN
    RAISE EXCEPTION 'old_owner_not_found_or_not_owner';
  END IF;

  -- Verificar que el nuevo owner es miembro activo y lockear su row.
  PERFORM 1
  FROM public.tournament_clan_members
  WHERE clan_id = p_clan_id
    AND user_id = p_new_owner_id
    AND left_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'new_owner_not_member';
  END IF;

  -- Demote viejo a member.
  UPDATE public.tournament_clan_members
  SET role = 'member'
  WHERE clan_id = p_clan_id AND user_id = p_old_owner_id;

  -- Promote nuevo a owner.
  UPDATE public.tournament_clan_members
  SET role = 'owner'
  WHERE clan_id = p_clan_id AND user_id = p_new_owner_id;

  -- Sync owner_id en tabla de clanes.
  UPDATE public.tournament_clans
  SET owner_id = p_new_owner_id
  WHERE id = p_clan_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_clan_transfer_owner(uuid, uuid, uuid) TO service_role;
