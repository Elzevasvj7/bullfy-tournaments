
-- ============================================
-- BULLFY eCOMMERCE MODULE
-- ============================================

-- 1. Commerce Access Toggle (per IB)
CREATE TABLE public.portal_commerce_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ib_id)
);
ALTER TABLE public.portal_commerce_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commerce access"
  ON public.portal_commerce_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Authenticated users can view commerce access"
  ON public.portal_commerce_access FOR SELECT
  TO authenticated
  USING (true);

-- 2. Portal Products
CREATE TABLE public.portal_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  product_type text NOT NULL DEFAULT 'digital',
  reference_id uuid,
  status text NOT NULL DEFAULT 'active',
  image_url text,
  display_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_portal_products_portal ON public.portal_products(portal_id);

-- Anyone can view active products (public storefront)
CREATE POLICY "Anyone can view active portal products"
  ON public.portal_products FOR SELECT
  USING (status = 'active');

-- Portal owner (IB) and admins can manage products
CREATE POLICY "Portal owner manages products"
  ON public.portal_products FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_products.portal_id
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
      WHERE pp.id = portal_products.portal_id
      AND ib.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'ib_externo')
  );

-- 3. Shopping Cart
CREATE TABLE public.portal_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.portal_products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_user_id, product_id)
);
ALTER TABLE public.portal_cart_items ENABLE ROW LEVEL SECURITY;

-- Cart is managed via edge functions with service role (partner_users aren't auth.users)
CREATE POLICY "Service role manages cart"
  ON public.portal_cart_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated internal users (admins) can view
CREATE POLICY "Admins view cart"
  ON public.portal_cart_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

-- 4. Orders
CREATE TABLE public.portal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id),
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id),
  order_number text NOT NULL,
  total_usd numeric(10,2) NOT NULL DEFAULT 0,
  payment_gateway text,
  payment_reference text,
  payment_status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_portal_orders_portal ON public.portal_orders(portal_id);
CREATE INDEX idx_portal_orders_user ON public.portal_orders(partner_user_id);

CREATE POLICY "Service role manages orders"
  ON public.portal_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and portal owners view orders"
  ON public.portal_orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_orders.portal_id
      AND ib.created_by = auth.uid()
    )
  );

-- 5. Order Items
CREATE TABLE public.portal_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.portal_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.portal_products(id),
  unit_price numeric(10,2) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages order items"
  ON public.portal_order_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and portal owners view order items"
  ON public.portal_order_items FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.portal_orders po
      JOIN public.partner_portals pp ON pp.id = po.portal_id
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE po.id = portal_order_items.order_id
      AND ib.created_by = auth.uid()
    )
  );

-- 6. Ledger (per-portal accounting)
CREATE TABLE public.portal_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id),
  order_id uuid REFERENCES public.portal_orders(id),
  entry_type text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  counterpart_id uuid,
  description text,
  balance_after numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_portal_ledger_portal ON public.portal_ledger(portal_id);

CREATE POLICY "Service role manages ledger"
  ON public.portal_ledger FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and portal owners view ledger"
  ON public.portal_ledger FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_ledger.portal_id
      AND ib.created_by = auth.uid()
    )
  );

-- 7. Revenue Splits (rules per portal)
CREATE TABLE public.portal_revenue_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  role_label text NOT NULL,
  percentage numeric(5,2) NOT NULL,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portal_id, role_label)
);
ALTER TABLE public.portal_revenue_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages splits"
  ON public.portal_revenue_splits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and portal owners manage splits"
  ON public.portal_revenue_splits FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_revenue_splits.portal_id
      AND ib.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_revenue_splits.portal_id
      AND ib.created_by = auth.uid()
    )
  );

-- 8. Commissions
CREATE TABLE public.portal_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.portal_orders(id),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id),
  beneficiary_type text NOT NULL,
  beneficiary_id text,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_commissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_portal_commissions_portal ON public.portal_commissions(portal_id);
CREATE INDEX idx_portal_commissions_order ON public.portal_commissions(order_id);

CREATE POLICY "Service role manages commissions"
  ON public.portal_commissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and portal owners view commissions"
  ON public.portal_commissions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_commissions.portal_id
      AND ib.created_by = auth.uid()
    )
  );

-- 9. Auto-generate order numbers
CREATE OR REPLACE FUNCTION public.generate_portal_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  _seq int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO _seq
    FROM public.portal_orders
    WHERE portal_id = NEW.portal_id;
  NEW.order_number := 'ORD-' || LPAD(_seq::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_order_number
  BEFORE INSERT ON public.portal_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_portal_order_number();

-- 10. Auto updated_at triggers
CREATE TRIGGER update_portal_products_updated_at
  BEFORE UPDATE ON public.portal_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_orders_updated_at
  BEFORE UPDATE ON public.portal_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_commerce_access_updated_at
  BEFORE UPDATE ON public.portal_commerce_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_revenue_splits_updated_at
  BEFORE UPDATE ON public.portal_revenue_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_commissions_updated_at
  BEFORE UPDATE ON public.portal_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Default revenue splits on portal creation
CREATE OR REPLACE FUNCTION public.create_default_revenue_splits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only when commerce access is enabled
  IF NEW.enabled = true AND (OLD IS NULL OR OLD.enabled = false) THEN
    INSERT INTO public.portal_revenue_splits (portal_id, role_label, percentage, priority)
    SELECT pp.id, splits.role_label, splits.percentage, splits.priority
    FROM public.partner_portals pp
    CROSS JOIN (VALUES
      ('platform', 10.00, 1),
      ('portal_owner', 80.00, 2),
      ('referrer', 10.00, 3)
    ) AS splits(role_label, percentage, priority)
    WHERE pp.ib_id = NEW.ib_id::text
    ON CONFLICT (portal_id, role_label) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_default_revenue_splits
  AFTER INSERT OR UPDATE ON public.portal_commerce_access
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_revenue_splits();
