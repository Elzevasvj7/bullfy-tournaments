CREATE TABLE IF NOT EXISTS public.partner_tiers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id   uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  description text,
  color       text,
  sort_order  int  NOT NULL DEFAULT 0,
  is_default  boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portal_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_tiers TO authenticated;
GRANT SELECT ON public.partner_tiers TO anon;
GRANT ALL ON public.partner_tiers TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_tiers_one_default
  ON public.partner_tiers (portal_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_partner_tiers_portal
  ON public.partner_tiers (portal_id, sort_order);

ALTER TABLE public.partner_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active tiers" ON public.partner_tiers;
CREATE POLICY "Anyone can view active tiers"
  ON public.partner_tiers FOR SELECT
  USING (active = true);

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

DROP TRIGGER IF EXISTS update_partner_tiers_updated_at ON public.partner_tiers;
CREATE TRIGGER update_partner_tiers_updated_at
  BEFORE UPDATE ON public.partner_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.partner_tiers (portal_id, slug, name, sort_order, is_default)
SELECT pp.id, t.slug, t.name, t.ord, t.is_def
FROM public.partner_portals pp
CROSS JOIN (VALUES
  ('general', 'General', 0, true),
  ('vip',     'VIP',     1, false),
  ('platino', 'Platino', 2, false)
) AS t(slug, name, ord, is_def)
ON CONFLICT (portal_id, slug) DO NOTHING;

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