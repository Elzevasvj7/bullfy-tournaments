-- ============================================================================
-- Fase 3 / P4b — Enforcement de revenue splits (suma = 100%, estricto)
-- ----------------------------------------------------------------------------
-- Antes la validación de "suma 100%" era solo un aviso visual en el frontend y
-- se guardaba por-fila (UPDATE on-blur), por lo que se podían persistir splits
-- que no sumaban 100. Ahora:
--   - CHECK por columna (0 <= percentage <= 100);
--   - RPC save_revenue_splits que valida suma EXACTA = 100, autoriza al dueño
--     del portal (o global_admin) y guarda TODOS los splits a la vez (rechaza
--     con EXCEPTION si la suma no es 100). El frontend llamará a este RPC.
-- Idempotente.
-- ============================================================================

-- ── CHECK de rango por columna (0..100) ──────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.portal_revenue_splits'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%percentage%'
  LOOP
    EXECUTE 'ALTER TABLE public.portal_revenue_splits DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;
ALTER TABLE public.portal_revenue_splits
  ADD CONSTRAINT portal_revenue_splits_percentage_range
  CHECK (percentage >= 0 AND percentage <= 100);

-- ── RPC: guardar todos los splits validando suma = 100 ───────────────────────
CREATE OR REPLACE FUNCTION public.save_revenue_splits(_portal_id UUID, _splits JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _authorized BOOLEAN;
  _sum NUMERIC(8,2) := 0;
  _final NUMERIC(8,2);
  _rec JSONB;
  _pct NUMERIC;
BEGIN
  -- Autorización: dueño del portal (vía ibs.created_by), global_admin o admin
  -- (mismos roles que la RLS de la tabla 'Admins and portal owners manage splits').
  SELECT (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = _portal_id AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
    OR public.has_role(auth.uid(), 'admin')
  ) INTO _authorized;

  IF NOT _authorized THEN
    RAISE EXCEPTION 'No autorizado para configurar los splits de este portal';
  END IF;

  IF _splits IS NULL OR jsonb_array_length(_splits) = 0 THEN
    RAISE EXCEPTION 'No se recibieron splits';
  END IF;

  -- Validar rangos y acumular suma.
  FOR _rec IN SELECT * FROM jsonb_array_elements(_splits) LOOP
    _pct := (_rec->>'percentage')::NUMERIC;
    IF _pct IS NULL OR _pct < 0 OR _pct > 100 THEN
      RAISE EXCEPTION 'Porcentaje inválido: %', _pct;
    END IF;
    _sum := _sum + _pct;
  END LOOP;

  IF round(_sum, 2) <> 100 THEN
    RAISE EXCEPTION 'Los porcentajes deben sumar exactamente 100%% (suma recibida: %)', _sum;
  END IF;

  -- Aplicar: actualiza el percentage de cada split por role_label.
  FOR _rec IN SELECT * FROM jsonb_array_elements(_splits) LOOP
    UPDATE public.portal_revenue_splits
       SET percentage = (_rec->>'percentage')::NUMERIC,
           updated_at = now()
     WHERE portal_id = _portal_id
       AND role_label = (_rec->>'role_label');
  END LOOP;

  -- Verificación final sobre la TABLA (no solo el payload): si el caller mandó
  -- un subconjunto que sumaba 100 pero omitió role_labels existentes, el estado
  -- real podría no sumar 100. Esto aborta (rollback) ese caso.
  SELECT COALESCE(SUM(percentage), 0) INTO _final
  FROM public.portal_revenue_splits WHERE portal_id = _portal_id;
  IF round(_final, 2) <> 100 THEN
    RAISE EXCEPTION 'El estado final de los splits del portal no suma 100%% (suma: %)', _final;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_revenue_splits(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_revenue_splits(UUID, JSONB) TO authenticated;

-- ── RPC: balance actual del ledger (exacto, robusto a débitos y al límite del
-- fetch del cliente). SUM(amount) = balance acumulado real del portal. ─────────
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
