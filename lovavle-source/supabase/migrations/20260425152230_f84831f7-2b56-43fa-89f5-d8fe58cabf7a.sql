-- ============================================================
-- FASE A: Multinivel Multi-Producto
-- ============================================================

-- 1. Add commission_mode + business_partners_enabled to mlm config
ALTER TABLE public.portal_mlm_config
  ADD COLUMN IF NOT EXISTS commission_mode TEXT NOT NULL DEFAULT 'pool',
  ADD COLUMN IF NOT EXISTS business_partners_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.portal_mlm_config
  DROP CONSTRAINT IF EXISTS portal_mlm_config_commission_mode_check;
ALTER TABLE public.portal_mlm_config
  ADD CONSTRAINT portal_mlm_config_commission_mode_check
  CHECK (commission_mode IN ('pool','multi_product'));

-- 2. Per-product commission levels table
CREATE TABLE IF NOT EXISTS public.portal_product_commission_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.portal_products(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  level_number INT NOT NULL CHECK (level_number BETWEEN 1 AND 10),
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, level_number)
);

CREATE INDEX IF NOT EXISTS idx_pcl_product ON public.portal_product_commission_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_pcl_portal ON public.portal_product_commission_levels(portal_id);

-- Trigger: validate sum <= 100 per product
CREATE OR REPLACE FUNCTION public.validate_product_commission_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _sum NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentage), 0) INTO _sum
  FROM public.portal_product_commission_levels
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF TG_OP <> 'DELETE' THEN
    _sum := _sum + NEW.percentage;
  END IF;

  IF _sum > 100 THEN
    RAISE EXCEPTION 'La suma de porcentajes del producto no puede exceder 100%% (actual: %)', _sum;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_commission_sum ON public.portal_product_commission_levels;
CREATE TRIGGER trg_validate_product_commission_sum
BEFORE INSERT OR UPDATE OR DELETE ON public.portal_product_commission_levels
FOR EACH ROW EXECUTE FUNCTION public.validate_product_commission_sum();

DROP TRIGGER IF EXISTS trg_pcl_updated_at ON public.portal_product_commission_levels;
CREATE TRIGGER trg_pcl_updated_at
BEFORE UPDATE ON public.portal_product_commission_levels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FASE B: Business Partners
-- ============================================================

-- 1. Eligibility flag on partner_users
ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS can_be_business_partner BOOLEAN NOT NULL DEFAULT false;

-- 2. Business partners table
CREATE TABLE IF NOT EXISTS public.portal_business_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portal_id, partner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pbp_portal ON public.portal_business_partners(portal_id);
CREATE INDEX IF NOT EXISTS idx_pbp_user ON public.portal_business_partners(partner_user_id);

-- Trigger: validate user belongs to portal AND is eligible AND sum<=100
CREATE OR REPLACE FUNCTION public.validate_business_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _user_portal UUID;
  _eligible BOOLEAN;
  _sum NUMERIC;
BEGIN
  SELECT portal_id, can_be_business_partner
    INTO _user_portal, _eligible
  FROM public.partner_users
  WHERE id = NEW.partner_user_id;

  IF _user_portal IS NULL THEN
    RAISE EXCEPTION 'partner_user_id no existe';
  END IF;

  IF _user_portal <> NEW.portal_id THEN
    RAISE EXCEPTION 'El usuario no pertenece a este portal';
  END IF;

  IF NOT COALESCE(_eligible, false) THEN
    RAISE EXCEPTION 'El usuario no está habilitado como elegible para ser socio de portal';
  END IF;

  IF NEW.active THEN
    SELECT COALESCE(SUM(percentage), 0) INTO _sum
    FROM public.portal_business_partners
    WHERE portal_id = NEW.portal_id
      AND active = true
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    _sum := _sum + NEW.percentage;
    IF _sum > 100 THEN
      RAISE EXCEPTION 'La suma de %% de socios activos no puede exceder 100%% (actual: %)', _sum;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_business_partner ON public.portal_business_partners;
CREATE TRIGGER trg_validate_business_partner
BEFORE INSERT OR UPDATE ON public.portal_business_partners
FOR EACH ROW EXECUTE FUNCTION public.validate_business_partner();

DROP TRIGGER IF EXISTS trg_pbp_updated_at ON public.portal_business_partners;
CREATE TRIGGER trg_pbp_updated_at
BEFORE UPDATE ON public.portal_business_partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FASE C: Helper for global_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'global_admin'::app_role)
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.portal_product_commission_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_business_partners ENABLE ROW LEVEL SECURITY;

-- Helper: check if current auth.uid() owns a portal (via ibs.created_by)
CREATE OR REPLACE FUNCTION public.is_portal_owner(_portal_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partner_portals pp
    JOIN public.ibs i ON i.id = pp.ib_id
    WHERE pp.id = _portal_id
      AND i.created_by = auth.uid()
  )
$$;

-- portal_product_commission_levels policies
DROP POLICY IF EXISTS "pcl_select" ON public.portal_product_commission_levels;
CREATE POLICY "pcl_select" ON public.portal_product_commission_levels
FOR SELECT USING (true); -- public read (clients need to see comissions)

DROP POLICY IF EXISTS "pcl_owner_admin_insert" ON public.portal_product_commission_levels;
CREATE POLICY "pcl_owner_admin_insert" ON public.portal_product_commission_levels
FOR INSERT WITH CHECK (
  public.is_global_admin() OR public.is_portal_owner(portal_id)
);

DROP POLICY IF EXISTS "pcl_owner_admin_update" ON public.portal_product_commission_levels;
CREATE POLICY "pcl_owner_admin_update" ON public.portal_product_commission_levels
FOR UPDATE USING (
  public.is_global_admin() OR public.is_portal_owner(portal_id)
);

DROP POLICY IF EXISTS "pcl_owner_admin_delete" ON public.portal_product_commission_levels;
CREATE POLICY "pcl_owner_admin_delete" ON public.portal_product_commission_levels
FOR DELETE USING (
  public.is_global_admin() OR public.is_portal_owner(portal_id)
);

-- portal_business_partners policies
DROP POLICY IF EXISTS "pbp_select_owner_admin_self" ON public.portal_business_partners;
CREATE POLICY "pbp_select_owner_admin_self" ON public.portal_business_partners
FOR SELECT USING (
  public.is_global_admin() 
  OR public.is_portal_owner(portal_id)
  OR partner_user_id IN (SELECT id FROM public.partner_users WHERE id = partner_user_id)
);

DROP POLICY IF EXISTS "pbp_owner_admin_insert" ON public.portal_business_partners;
CREATE POLICY "pbp_owner_admin_insert" ON public.portal_business_partners
FOR INSERT WITH CHECK (
  public.is_global_admin() OR public.is_portal_owner(portal_id)
);

DROP POLICY IF EXISTS "pbp_owner_admin_update" ON public.portal_business_partners;
CREATE POLICY "pbp_owner_admin_update" ON public.portal_business_partners
FOR UPDATE USING (
  public.is_global_admin() OR public.is_portal_owner(portal_id)
);

DROP POLICY IF EXISTS "pbp_owner_admin_delete" ON public.portal_business_partners;
CREATE POLICY "pbp_owner_admin_delete" ON public.portal_business_partners
FOR DELETE USING (
  public.is_global_admin() OR public.is_portal_owner(portal_id)
);