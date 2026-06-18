
-- INVOICES (escaneadas por OCR)
CREATE TABLE IF NOT EXISTS public.accounting_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  ocr_raw JSONB,
  ocr_confidence NUMERIC(5,2),
  vendor_name TEXT,
  vendor_id UUID REFERENCES public.accounting_vendors(id) ON DELETE SET NULL,
  invoice_number TEXT,
  issue_date DATE,
  currency_original TEXT REFERENCES public.accounting_currencies(code),
  amount_original NUMERIC(18,4),
  tax_amount NUMERIC(18,4) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected','linked')),
  rejected_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_status ON public.accounting_invoices(status);
CREATE INDEX IF NOT EXISTS idx_inv_uploaded_by ON public.accounting_invoices(uploaded_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_invoices TO authenticated;
GRANT ALL ON public.accounting_invoices TO service_role;
ALTER TABLE public.accounting_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_select" ON public.accounting_invoices FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role)
    OR public.has_role(auth.uid(),'directivo'::app_role)
  );
CREATE POLICY "inv_insert" ON public.accounting_invoices FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "inv_update" ON public.accounting_invoices FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role)
    OR (uploaded_by = auth.uid() AND status = 'pending_review')
  );
CREATE POLICY "inv_delete" ON public.accounting_invoices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- EXPENSES
CREATE TABLE IF NOT EXISTS public.accounting_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL,
  payment_date DATE,
  amount_original NUMERIC(18,4) NOT NULL CHECK (amount_original >= 0),
  currency_original TEXT NOT NULL REFERENCES public.accounting_currencies(code),
  fx_rate_to_usd NUMERIC(20,10),
  amount_usd NUMERIC(18,4),
  category_id UUID REFERENCES public.accounting_expense_categories(id) ON DELETE SET NULL,
  geography_id UUID REFERENCES public.accounting_geographies(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.accounting_cost_centers(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.accounting_vendors(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.accounting_payment_methods(id) ON DELETE SET NULL,
  user_id UUID,
  invoice_id UUID REFERENCES public.accounting_invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','paid','reconciled','void')),
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exp_date ON public.accounting_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_exp_cat ON public.accounting_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_exp_user ON public.accounting_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_exp_geo ON public.accounting_expenses(geography_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_expenses TO authenticated;
GRANT ALL ON public.accounting_expenses TO service_role;
ALTER TABLE public.accounting_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exp_select" ON public.accounting_expenses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role)
    OR public.has_role(auth.uid(),'directivo'::app_role)
    OR user_id = auth.uid() OR created_by = auth.uid()
  );
CREATE POLICY "exp_insert" ON public.accounting_expenses FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'treasurer'::app_role) OR true)
  );
CREATE POLICY "exp_update" ON public.accounting_expenses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR created_by = auth.uid());
CREATE POLICY "exp_delete" ON public.accounting_expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- Trigger: auto-compute FX and amount_usd
CREATE OR REPLACE FUNCTION public.accounting_set_fx_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.fx_rate_to_usd IS NULL THEN
    NEW.fx_rate_to_usd := public.get_fx_to_usd(NEW.currency_original, NEW.expense_date);
  END IF;
  NEW.amount_usd := ROUND(NEW.amount_original * NEW.fx_rate_to_usd, 4);
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_exp_fx ON public.accounting_expenses;
CREATE TRIGGER trg_exp_fx BEFORE INSERT OR UPDATE ON public.accounting_expenses
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_fx_expense();

-- REVENUE SOURCES
CREATE TABLE IF NOT EXISTS public.accounting_revenue_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual','tournament_orders','crm_sale','other')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_revenue_sources TO authenticated;
GRANT ALL ON public.accounting_revenue_sources TO service_role;
ALTER TABLE public.accounting_revenue_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_sel" ON public.accounting_revenue_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "rs_wr" ON public.accounting_revenue_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

INSERT INTO public.accounting_revenue_sources(name, source_type) VALUES
  ('Manual','manual'),('Bullfy Tournament','tournament_orders'),('CRM','crm_sale')
ON CONFLICT (name) DO NOTHING;

-- REVENUES
CREATE TABLE IF NOT EXISTS public.accounting_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  revenue_date DATE NOT NULL,
  amount_original NUMERIC(18,4) NOT NULL CHECK (amount_original >= 0),
  currency_original TEXT NOT NULL REFERENCES public.accounting_currencies(code),
  fx_rate_to_usd NUMERIC(20,10),
  amount_usd NUMERIC(18,4),
  category_id UUID REFERENCES public.accounting_revenue_categories(id) ON DELETE SET NULL,
  geography_id UUID REFERENCES public.accounting_geographies(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.accounting_cost_centers(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.accounting_revenue_sources(id) ON DELETE SET NULL,
  external_ref TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rev_date ON public.accounting_revenues(revenue_date DESC);
CREATE INDEX IF NOT EXISTS idx_rev_source ON public.accounting_revenues(source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rev_external_ref ON public.accounting_revenues(source_id, external_ref) WHERE external_ref IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_revenues TO authenticated;
GRANT ALL ON public.accounting_revenues TO service_role;
ALTER TABLE public.accounting_revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev_sel" ON public.accounting_revenues FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'directivo'::app_role)
  );
CREATE POLICY "rev_wr" ON public.accounting_revenues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

CREATE OR REPLACE FUNCTION public.accounting_set_fx_revenue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.fx_rate_to_usd IS NULL THEN
    NEW.fx_rate_to_usd := public.get_fx_to_usd(NEW.currency_original, NEW.revenue_date);
  END IF;
  NEW.amount_usd := ROUND(NEW.amount_original * NEW.fx_rate_to_usd, 4);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rev_fx ON public.accounting_revenues;
CREATE TRIGGER trg_rev_fx BEFORE INSERT OR UPDATE ON public.accounting_revenues
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_fx_revenue();

-- TOURNAMENT SYNC LOG (idempotencia)
CREATE TABLE IF NOT EXISTS public.accounting_tournament_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_order_id TEXT NOT NULL UNIQUE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revenue_id UUID REFERENCES public.accounting_revenues(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.accounting_expenses(id) ON DELETE SET NULL,
  amount_usd NUMERIC(18,4),
  notes TEXT
);
GRANT SELECT ON public.accounting_tournament_sync_log TO authenticated;
GRANT ALL ON public.accounting_tournament_sync_log TO service_role;
ALTER TABLE public.accounting_tournament_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_sel" ON public.accounting_tournament_sync_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'directivo'::app_role));

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS public.accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.accounting_audit_log(entity, entity_id, created_at DESC);
GRANT SELECT, INSERT ON public.accounting_audit_log TO authenticated;
GRANT ALL ON public.accounting_audit_log TO service_role;
ALTER TABLE public.accounting_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_sel" ON public.accounting_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'directivo'::app_role));
CREATE POLICY "audit_ins" ON public.accounting_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Updated_at trigger for invoices
CREATE OR REPLACE FUNCTION public.accounting_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_inv_touch ON public.accounting_invoices;
CREATE TRIGGER trg_inv_touch BEFORE UPDATE ON public.accounting_invoices
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_updated_at();
