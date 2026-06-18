-- =============================================================================
-- Niveles personalizados por portal (por IB)
-- =============================================================================
-- Hoy los niveles (general/vip/platino) están hardcodeados en el frontend y
-- compartidos. Esta migración los hace PROPIOS de cada IB (por portal), sin que
-- un IB pise los de otro.
--
-- Diseño:
--   - `slug` es la clave ESTABLE que ya guardan partner_users.tier y los
--     required_tiers[] de cursos/eventos/etc. El IB edita el `name` (display);
--     el slug no cambia, por eso renombrar no rompe referencias existentes.
--   - Se siembran general/vip/platino en cada portal existente (backfill) y un
--     trigger los siembra al crear un portal nuevo, así nada queda huérfano.
--   - Acceso: sigue siendo EXPLÍCITO (set-based). Esta tabla solo DEFINE los
--     niveles; el filtrado por required_tiers no cambia de semántica.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.partner_tiers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id   uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  slug        text NOT NULL,                 -- clave estable (vip, oro, …)
  name        text NOT NULL,                 -- nombre visible, editable
  description text,
  color       text,                          -- opcional, para badges en UI
  sort_order  int  NOT NULL DEFAULT 0,
  is_default  boolean NOT NULL DEFAULT false, -- nivel base gratuito (entrada)
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portal_id, slug)
);

-- Un único nivel base por portal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_tiers_one_default
  ON public.partner_tiers (portal_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_partner_tiers_portal
  ON public.partner_tiers (portal_id, sort_order);

ALTER TABLE public.partner_tiers ENABLE ROW LEVEL SECURITY;

-- Lectura pública de niveles activos (clientes ven nombres / tienda).
DROP POLICY IF EXISTS "Anyone can view active tiers" ON public.partner_tiers;
CREATE POLICY "Anyone can view active tiers"
  ON public.partner_tiers FOR SELECT
  USING (active = true);

-- El IB dueño del portal (y admins) gestiona sus niveles. Mismo predicado que
-- portal_products ("Portal owner manages products").
DROP POLICY IF EXISTS "Portal owner manages tiers" ON public.partner_tiers;
CREATE POLICY "Portal owner manages tiers"
  ON public.partner_tiers FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = partner_tiers.portal_id
      AND ib.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'ib_externo')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = partner_tiers.portal_id
      AND ib.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'ib_externo')
  );

CREATE TRIGGER update_partner_tiers_updated_at
  BEFORE UPDATE ON public.partner_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Backfill: sembrar general/vip/platino en TODOS los portales existentes.
-- -----------------------------------------------------------------------------
INSERT INTO public.partner_tiers (portal_id, slug, name, sort_order, is_default)
SELECT pp.id, t.slug, t.name, t.ord, t.is_def
FROM public.partner_portals pp
CROSS JOIN (VALUES
  ('general', 'General', 0, true),
  ('vip',     'VIP',     1, false),
  ('platino', 'Platino', 2, false)
) AS t(slug, name, ord, is_def)
ON CONFLICT (portal_id, slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Trigger: sembrar niveles base al crear un portal nuevo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_partner_tiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.partner_tiers (portal_id, slug, name, sort_order, is_default)
  VALUES
    (NEW.id, 'general', 'General', 0, true),
    (NEW.id, 'vip',     'VIP',     1, false),
    (NEW.id, 'platino', 'Platino', 2, false)
  ON CONFLICT (portal_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_partner_tiers ON public.partner_portals;
CREATE TRIGGER trg_seed_default_partner_tiers
  AFTER INSERT ON public.partner_portals
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_partner_tiers();

-- -----------------------------------------------------------------------------
-- Storage: bucket para imágenes de productos/membresías (público).
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-product-images', 'portal-product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
CREATE POLICY "Public can read product images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'portal-product-images');

DROP POLICY IF EXISTS "Authenticated can upload product images" ON storage.objects;
CREATE POLICY "Authenticated can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portal-product-images');

DROP POLICY IF EXISTS "Authenticated can update product images" ON storage.objects;
CREATE POLICY "Authenticated can update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portal-product-images');

DROP POLICY IF EXISTS "Authenticated can delete product images" ON storage.objects;
CREATE POLICY "Authenticated can delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portal-product-images');

COMMENT ON TABLE public.partner_tiers IS
  'Niveles personalizables por portal (por IB). slug = clave estable usada en partner_users.tier y required_tiers[]; name = display editable.';
