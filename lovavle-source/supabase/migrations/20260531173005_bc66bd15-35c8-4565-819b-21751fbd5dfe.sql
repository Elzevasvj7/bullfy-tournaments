-- ============================================================================
-- C6 — Blindaje de integridad del árbol MLM (portal_mlm_referrals)
-- Aplicado tal cual desde supabase/migrations/20260531130000_mlm_referral_integrity.sql
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
  IF NEW.sponsor_id IS NULL THEN
    NEW.upline_chain := '{}';
    RETURN NEW;
  END IF;

  IF NEW.sponsor_id = NEW.user_id THEN
    RAISE WARNING 'MLM: auto-sponsor neutralizado para user %', NEW.user_id;
    NEW.sponsor_id := NULL;
    NEW.upline_chain := '{}';
    RETURN NEW;
  END IF;

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

  SELECT r.upline_chain INTO _sponsor_chain
  FROM public.portal_mlm_referrals r
  WHERE r.portal_id = NEW.portal_id AND r.user_id = NEW.sponsor_id;
  _sponsor_chain := COALESCE(_sponsor_chain, '{}');

  IF NEW.user_id = ANY(_sponsor_chain) THEN
    RAISE WARNING 'MLM: ciclo detectado (user % en upline del sponsor %) → huerfano',
      NEW.user_id, _orig_sponsor;
    NEW.sponsor_id := NULL;
    NEW.upline_chain := '{}';
    RETURN NEW;
  END IF;

  NEW.upline_chain := array_prepend(NEW.sponsor_id, _sponsor_chain);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_mlm_referral ON public.portal_mlm_referrals;
CREATE TRIGGER trg_validate_mlm_referral
  BEFORE INSERT OR UPDATE OF sponsor_id, upline_chain, user_id, portal_id
  ON public.portal_mlm_referrals
  FOR EACH ROW EXECUTE FUNCTION public.validate_mlm_referral();