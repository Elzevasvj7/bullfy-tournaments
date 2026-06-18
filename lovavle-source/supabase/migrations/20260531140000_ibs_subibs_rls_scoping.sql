-- ============================================================================
-- RLS scoping de las tablas maestras de IBs (ibs, sub_ibs)
-- ----------------------------------------------------------------------------
-- Hoy ambas tienen "FOR SELECT TO authenticated USING (true)": cualquier
-- usuario autenticado (incluido un 'ib_externo' invitado) puede leer la config,
-- comisiones y estructura de TODOS los IBs, incluidos los rivales (QA — fuga
-- inter-IB). anon nunca lee estas tablas (las policies son TO authenticated).
--
-- Política acordada:
--   • Staff interno de Bullfy ve TODOS los IBs (lo necesita para el CRM):
--     admin, global_admin, bd, operaciones, admin_operaciones, admin_bd,
--     marketing, ventas, admin_ventas, dealing.
--   • Cualquier otro autenticado (p. ej. 'ib_externo', 'user') solo ve el IB
--     al que está vinculado: ibs.created_by = él, o profiles.ib_id = ese IB
--     (y para sub_ibs, también profiles.sub_ib_id).
--
-- Idempotente: CREATE OR REPLACE + DROP POLICY IF EXISTS.
-- ============================================================================

-- Helper: ¿el usuario tiene algún rol de staff interno de Bullfy?
-- STABLE + SECURITY DEFINER para poder leerse dentro de policies sin recursión.
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'admin', 'global_admin', 'bd', 'operaciones', 'admin_operaciones',
        'admin_bd', 'marketing', 'ventas', 'admin_ventas', 'dealing'
      )
  )
$$;

-- ── ibs ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read IBs" ON public.ibs;

CREATE POLICY "Read IBs: internal staff or own IB"
  ON public.ibs FOR SELECT TO authenticated
  USING (
    public.is_internal_staff(auth.uid())
    OR ibs.created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.ib_id = ibs.id
    )
  );

-- ── sub_ibs ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read sub IBs" ON public.sub_ibs;

CREATE POLICY "Read sub IBs: internal staff or own IB"
  ON public.sub_ibs FOR SELECT TO authenticated
  USING (
    public.is_internal_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.ibs i
      WHERE i.id = sub_ibs.ib_id
        AND (
          i.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.ib_id = i.id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.sub_ib_id = sub_ibs.id
    )
  );
