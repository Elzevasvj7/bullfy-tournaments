-- ============================================================================
-- QA #5 (cierre) — Desactivar Socios del Portal al perder elegibilidad
-- ----------------------------------------------------------------------------
-- El backend ya valida la elegibilidad (can_be_business_partner) al INSERTAR/
-- ACTUALIZAR una fila de portal_business_partners (trigger validate_business_
-- partner) + RLS por dueño/global_admin. Brecha residual: si a un usuario que
-- YA era BP activo se le quita la elegibilidad (can_be_business_partner=false),
-- su fila seguía 'active' y seguiría cobrando. Este trigger cierra eso: al poner
-- la elegibilidad en false, desactiva automáticamente sus filas de BP.
-- Idempotente.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deactivate_bp_on_ineligible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.can_be_business_partner = false
     AND OLD.can_be_business_partner IS DISTINCT FROM NEW.can_be_business_partner THEN
    UPDATE public.portal_business_partners
       SET active = false
     WHERE partner_user_id = NEW.id
       AND active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_bp_on_ineligible ON public.partner_users;
CREATE TRIGGER trg_deactivate_bp_on_ineligible
  AFTER UPDATE OF can_be_business_partner ON public.partner_users
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_bp_on_ineligible();
