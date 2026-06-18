-- ============================================================================
-- P7 (integración con P4b) — get_portal_ledger_balance solo cuenta dinero REAL
-- ----------------------------------------------------------------------------
-- P4b creó get_portal_ledger_balance = SUM(amount) del portal. Con la doble
-- contabilidad (P7), el ledger ahora tiene filas real Y demo. El balance que ve
-- el DUEÑO del portal debe reflejar SOLO dinero real (el demo es para pruebas de
-- los IBs y se ve aparte). Se añade el filtro account_kind='real'. Misma autz.
-- Idempotente.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_portal_ledger_balance(_portal_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::numeric(12,2)
  FROM public.portal_ledger
  WHERE portal_id = _portal_id
    AND account_kind = 'real'
    AND (
      EXISTS (
        SELECT 1 FROM public.partner_portals pp
        JOIN public.ibs i ON i.id = pp.ib_id
        WHERE pp.id = _portal_id AND i.created_by = auth.uid()
      )
      OR public.has_role(auth.uid(), 'global_admin')
      OR public.has_role(auth.uid(), 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.get_portal_ledger_balance(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_portal_ledger_balance(UUID) TO authenticated;
