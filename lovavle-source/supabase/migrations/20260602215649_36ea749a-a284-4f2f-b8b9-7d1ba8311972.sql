
-- CURRENCIES
CREATE TABLE IF NOT EXISTS public.accounting_currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimal_places INT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_functional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.accounting_currencies TO authenticated;
GRANT ALL ON public.accounting_currencies TO service_role;
ALTER TABLE public.accounting_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cur_select" ON public.accounting_currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "cur_write" ON public.accounting_currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

INSERT INTO public.accounting_currencies(code, name, symbol, decimal_places, is_functional) VALUES
  ('USD','US Dollar','$',2,true),('COP','Peso Colombiano','$',0,false),
  ('AED','UAE Dirham','د.إ',2,false),('MXN','Peso Mexicano','$',2,false),
  ('EUR','Euro','€',2,false)
ON CONFLICT (code) DO NOTHING;

-- FX RATES
CREATE TABLE IF NOT EXISTS public.accounting_fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_from TEXT NOT NULL REFERENCES public.accounting_currencies(code),
  currency_to TEXT NOT NULL REFERENCES public.accounting_currencies(code),
  rate NUMERIC(20,10) NOT NULL CHECK (rate > 0),
  rate_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (currency_from, currency_to, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_fx_pair_date ON public.accounting_fx_rates(currency_from, currency_to, rate_date DESC);
GRANT SELECT ON public.accounting_fx_rates TO authenticated;
GRANT ALL ON public.accounting_fx_rates TO service_role;
ALTER TABLE public.accounting_fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_select" ON public.accounting_fx_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "fx_write" ON public.accounting_fx_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

CREATE OR REPLACE FUNCTION public.get_fx_to_usd(_currency TEXT, _date DATE)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rate NUMERIC;
BEGIN
  IF _currency = 'USD' THEN RETURN 1; END IF;
  SELECT rate INTO v_rate FROM public.accounting_fx_rates
  WHERE currency_from = _currency AND currency_to = 'USD' AND rate_date <= _date
  ORDER BY rate_date DESC LIMIT 1;
  RETURN COALESCE(v_rate, 1);
END $$;

-- GEOGRAPHIES
CREATE TABLE IF NOT EXISTS public.accounting_geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  country_code TEXT, city TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_geographies TO authenticated;
GRANT ALL ON public.accounting_geographies TO service_role;
ALTER TABLE public.accounting_geographies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_sel" ON public.accounting_geographies FOR SELECT TO authenticated USING (true);
CREATE POLICY "geo_wr" ON public.accounting_geographies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

INSERT INTO public.accounting_geographies(name, country_code, city) VALUES
  ('Colombia','CO',NULL),('Bogotá','CO','Bogotá'),('Medellín','CO','Medellín'),
  ('Emiratos Árabes Unidos','AE',NULL),('Dubái','AE','Dubai'),
  ('México','MX',NULL),('CDMX','MX','Ciudad de México'),
  ('USA','US',NULL),('España','ES',NULL),('Global','GLOBAL',NULL)
ON CONFLICT (name) DO NOTHING;

-- EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS public.accounting_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.accounting_expense_categories(id) ON DELETE SET NULL,
  code TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expcat_name_root ON public.accounting_expense_categories(name) WHERE parent_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_expense_categories TO authenticated;
GRANT ALL ON public.accounting_expense_categories TO service_role;
ALTER TABLE public.accounting_expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec_sel" ON public.accounting_expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ec_wr" ON public.accounting_expense_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

INSERT INTO public.accounting_expense_categories(name, code) VALUES
  ('Marketing','MKT'),('Tecnología','TECH'),('Operaciones','OPS'),('Nómina','HR'),
  ('Viajes y Representación','TRAVEL'),('Servicios Profesionales','PROF'),
  ('Comisiones de Pago','FEES'),('Premios de Torneo','TOURNAMENT_PRIZES'),
  ('Impuestos','TAX'),('Otros','OTHER')
ON CONFLICT DO NOTHING;

-- REVENUE CATEGORIES
CREATE TABLE IF NOT EXISTS public.accounting_revenue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_revenue_categories TO authenticated;
GRANT ALL ON public.accounting_revenue_categories TO service_role;
ALTER TABLE public.accounting_revenue_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc_sel" ON public.accounting_revenue_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "rc_wr" ON public.accounting_revenue_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

INSERT INTO public.accounting_revenue_categories(name, code) VALUES
  ('Inscripciones Torneo','TOURNAMENT_ENTRY'),('Patrocinios','SPONSORSHIP'),
  ('Servicios','SERVICES'),('Otros','OTHER')
ON CONFLICT (name) DO NOTHING;

-- VENDORS
CREATE TABLE IF NOT EXISTS public.accounting_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, tax_id TEXT, email TEXT, phone TEXT,
  geography_id UUID REFERENCES public.accounting_geographies(id) ON DELETE SET NULL,
  notes TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_name_tax ON public.accounting_vendors(name, COALESCE(tax_id,''));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_vendors TO authenticated;
GRANT ALL ON public.accounting_vendors TO service_role;
ALTER TABLE public.accounting_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ve_sel" ON public.accounting_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "ve_wr" ON public.accounting_vendors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- PAYMENT METHODS
CREATE TABLE IF NOT EXISTS public.accounting_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, kind TEXT NOT NULL DEFAULT 'bank',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_payment_methods TO authenticated;
GRANT ALL ON public.accounting_payment_methods TO service_role;
ALTER TABLE public.accounting_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_sel" ON public.accounting_payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "pm_wr" ON public.accounting_payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

INSERT INTO public.accounting_payment_methods(name, kind) VALUES
  ('Transferencia Bancaria','bank'),('Tarjeta Crédito Corp','card'),
  ('Efectivo','cash'),('USDT TRC20','crypto'),('USDT ERC20','crypto'),
  ('Stripe','gateway'),('Coinsbuy','gateway'),('NowPayments','gateway')
ON CONFLICT (name) DO NOTHING;

-- COST CENTERS
CREATE TABLE IF NOT EXISTS public.accounting_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_cost_centers TO authenticated;
GRANT ALL ON public.accounting_cost_centers TO service_role;
ALTER TABLE public.accounting_cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_sel" ON public.accounting_cost_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_wr" ON public.accounting_cost_centers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

INSERT INTO public.accounting_cost_centers(name, code) VALUES
  ('Bullfy Tournament','CC_TRN'),('Bullfy Live','CC_LIVE'),
  ('Marketing','CC_MKT'),('Tecnología','CC_TECH'),('Administración','CC_ADM')
ON CONFLICT (name) DO NOTHING;

-- TAX RATES
CREATE TABLE IF NOT EXISTS public.accounting_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, rate_pct NUMERIC(6,3) NOT NULL,
  geography_id UUID REFERENCES public.accounting_geographies(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_tax_rates TO authenticated;
GRANT ALL ON public.accounting_tax_rates TO service_role;
ALTER TABLE public.accounting_tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_sel" ON public.accounting_tax_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tx_wr" ON public.accounting_tax_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- FISCAL PERIODS
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, period_start DATE NOT NULL, period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','closed')),
  locked_by UUID, locked_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_fiscal_periods TO authenticated;
GRANT ALL ON public.accounting_fiscal_periods TO service_role;
ALTER TABLE public.accounting_fiscal_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fp_sel" ON public.accounting_fiscal_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "fp_wr" ON public.accounting_fiscal_periods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));
