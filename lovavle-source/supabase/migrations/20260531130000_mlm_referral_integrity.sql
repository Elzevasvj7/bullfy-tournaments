-- ============================================================================
-- C6 — Blindaje de integridad del árbol MLM (portal_mlm_referrals)
-- ----------------------------------------------------------------------------
-- Las inserciones a portal_mlm_referrals se hacen vía edge function
-- (service_role), que bypassea RLS. Si esa lógica falla o recibe datos
-- manipulados, se pueden crear relaciones inválidas: sponsor de otro portal,
-- auto-patrocinio, ciclos en la upline, o upline_chain inconsistente. Eso
-- corrompe el cálculo de comisiones (dinero mal atribuido / ciclos infinitos).
--
-- Este trigger valida a NIVEL DB (corre siempre, incluso con service_role) y
-- actúa como SANITIZADOR DEFENSIVO: en vez de abortar el INSERT (lo que
-- rompería el registro de usuarios), neutraliza el sponsor inválido dejándolo
-- huérfano (sponsor_id = NULL, upline vacío). Por la orphan_policy existente,
-- las comisiones de un huérfano van al portal_owner.
--
-- Invariantes garantizadas tras el trigger:
--   1. sponsor_id, si no es NULL, es un partner_user ACTIVO del MISMO portal.
--   2. Nunca auto-patrocinio (sponsor_id <> user_id).
--   3. Sin ciclos: el usuario no puede estar en la upline de su sponsor.
--   4. upline_chain canónica = [sponsor, ...upline_del_sponsor] (recomputada).
--
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_mlm_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orig_sponsor   UUID := NEW.sponsor_id;
  _sponsor_portal UUID;
  _sponsor_status TEXT;
  _sponsor_chain  UUID[];
BEGIN
  -- Sin sponsor → raíz / huérfano. Garantizar chain vacío.
  IF NEW.sponsor_id IS NULL THEN
    NEW.upline_chain := '{}';
    RETURN NEW;
  END IF;

  -- (2) Anti auto-patrocinio.
  IF NEW.sponsor_id = NEW.user_id THEN
    RAISE WARNING 'MLM: auto-sponsor neutralizado para user %', NEW.user_id;
    NEW.sponsor_id := NULL;
    NEW.upline_chain := '{}';
    RETURN NEW;
  END IF;

  -- (1) El sponsor debe ser partner_user ACTIVO del MISMO portal.
  -- El ciclo de vida real de partner_users.status es 'pending' → 'approved'
  -- (o 'rejected'); NO existe 'active'. Un sponsor utilizable es el que NO está
  -- 'pending' ni 'rejected' (mismo criterio que partner-portal-login).
  SELECT pu.portal_id, pu.status
    INTO _sponsor_portal, _sponsor_status
  FROM public.partner_users pu
  WHERE pu.id = NEW.sponsor_id;

  IF _sponsor_portal IS NULL
     OR _sponsor_portal <> NEW.portal_id
     OR _sponsor_status IN ('pending', 'rejected') THEN
    RAISE WARNING 'MLM: sponsor % invalido (inexistente/otro portal/no aprobado) para user % → huerfano',
      _orig_sponsor, NEW.user_id;
    NEW.sponsor_id := NULL;
    NEW.upline_chain := '{}';
    RETURN NEW;
  END IF;

  -- Upline del sponsor (puede no tener fila si es raíz → '{}').
  SELECT r.upline_chain INTO _sponsor_chain
  FROM public.portal_mlm_referrals r
  WHERE r.portal_id = NEW.portal_id AND r.user_id = NEW.sponsor_id;
  _sponsor_chain := COALESCE(_sponsor_chain, '{}');

  -- (3) Anti-ciclo: el usuario no puede estar en la upline de su sponsor.
  IF NEW.user_id = ANY(_sponsor_chain) THEN
    RAISE WARNING 'MLM: ciclo detectado (user % en upline del sponsor %) → huerfano',
      NEW.user_id, _orig_sponsor;
    NEW.sponsor_id := NULL;
    NEW.upline_chain := '{}';
    RETURN NEW;
  END IF;

  -- (4) Recomputar upline_chain canónica: [sponsor, ...upline_del_sponsor].
  NEW.upline_chain := array_prepend(NEW.sponsor_id, _sponsor_chain);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_mlm_referral ON public.portal_mlm_referrals;
CREATE TRIGGER trg_validate_mlm_referral
  BEFORE INSERT OR UPDATE OF sponsor_id, upline_chain, user_id, portal_id
  ON public.portal_mlm_referrals
  FOR EACH ROW EXECUTE FUNCTION public.validate_mlm_referral();
