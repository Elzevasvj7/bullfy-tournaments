
-- =============================================
-- BULLFY IB AUTOMATED SYSTEM - DATABASE SCHEMA
-- =============================================

-- 1. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. App roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Reference data tables
CREATE TABLE public.ref_spreads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  raw NUMERIC NOT NULL,
  spread_estandar NUMERIC NOT NULL,
  dolares_ib NUMERIC NOT NULL DEFAULT 7
);
ALTER TABLE public.ref_spreads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read spreads" ON public.ref_spreads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage spreads" ON public.ref_spreads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ref_cpa_latam (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rango_deposito TEXT NOT NULL,
  cpa_pagar NUMERIC NOT NULL
);
ALTER TABLE public.ref_cpa_latam ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read CPA" ON public.ref_cpa_latam FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage CPA" ON public.ref_cpa_latam FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ref_cpa_hibrido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rango_deposito TEXT NOT NULL,
  cpa_pagar NUMERIC NOT NULL,
  dolares_por_lote NUMERIC NOT NULL DEFAULT 4
);
ALTER TABLE public.ref_cpa_hibrido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read hybrid CPA" ON public.ref_cpa_hibrido FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage hybrid CPA" ON public.ref_cpa_hibrido FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ref_propfirm_comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rango_ventas TEXT NOT NULL,
  porcentaje_comision NUMERIC NOT NULL
);
ALTER TABLE public.ref_propfirm_comisiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read propfirm commissions" ON public.ref_propfirm_comisiones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage propfirm commissions" ON public.ref_propfirm_comisiones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ref_propfirm_cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  balance NUMERIC NOT NULL,
  precio NUMERIC NOT NULL
);
ALTER TABLE public.ref_propfirm_cuentas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read propfirm accounts" ON public.ref_propfirm_cuentas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage propfirm accounts" ON public.ref_propfirm_cuentas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Main IB table
CREATE TABLE public.ibs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_bd TEXT NOT NULL,
  nombre_ib TEXT NOT NULL,
  correo_ib TEXT NOT NULL,
  tipo_id TEXT NOT NULL,
  id_ib TEXT NOT NULL,
  lugar_operacion TEXT NOT NULL CHECK (lugar_operacion IN ('LATAM', 'Europa', 'Resto del Mundo')),
  tiene_sub_ibs BOOLEAN NOT NULL DEFAULT false,
  modelo_negocio TEXT NOT NULL CHECK (modelo_negocio IN ('Brokeraje', 'PropFirm', 'Ambos')),
  tipo_acuerdo_brokeraje TEXT CHECK (tipo_acuerdo_brokeraje IN ('Rebates', 'CPA', 'Híbrido')),
  cuentas_marketing_tipo TEXT CHECK (cuentas_marketing_tipo IN ('Real Marketing', 'Fondeo Marketing', 'Ambas')),
  cuentas_marketing_cantidad INTEGER,
  cuentas_marketing_balance NUMERIC,
  tiene_fondeo_regalo BOOLEAN DEFAULT false,
  fondeo_regalo_cantidad INTEGER,
  fondeo_regalo_balance NUMERIC,
  tiene_fondeo_especial BOOLEAN DEFAULT false,
  fondeo_especial_balance NUMERIC,
  clientes_por_mes INTEGER,
  depositos_por_mes NUMERIC,
  lotes_por_mes NUMERIC,
  cuentas_fondeo_vendidas INTEGER,
  tipo_cuenta_fondeo TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ibs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read IBs" ON public.ibs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage IBs" ON public.ibs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ibs_updated_at BEFORE UPDATE ON public.ibs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Sub IBs
CREATE TABLE public.sub_ibs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sub_ibs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read sub IBs" ON public.sub_ibs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sub IBs" ON public.sub_ibs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Custom spread config per IB
CREATE TABLE public.ib_spread_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  raw NUMERIC NOT NULL,
  spread_estandar NUMERIC NOT NULL,
  dolares_ib_original NUMERIC NOT NULL,
  nuevo_dolar_ib NUMERIC,
  diferencia NUMERIC GENERATED ALWAYS AS (COALESCE(nuevo_dolar_ib, dolares_ib_original) - dolares_ib_original) STORED,
  nuevo_spread_cliente NUMERIC GENERATED ALWAYS AS (spread_estandar + (COALESCE(nuevo_dolar_ib, dolares_ib_original) - dolares_ib_original)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ib_spread_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read spread config" ON public.ib_spread_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage spread config" ON public.ib_spread_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Custom CPA config per IB
CREATE TABLE public.ib_cpa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  rango_deposito TEXT NOT NULL,
  cpa_pagar NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ib_cpa_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read CPA config" ON public.ib_cpa_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage CPA config" ON public.ib_cpa_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. Custom hybrid config per IB
CREATE TABLE public.ib_hybrid_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  rango_deposito TEXT NOT NULL,
  cpa_pagar NUMERIC NOT NULL,
  dolares_por_lote NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ib_hybrid_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read hybrid config" ON public.ib_hybrid_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage hybrid config" ON public.ib_hybrid_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. Custom PropFirm commission config per IB
CREATE TABLE public.ib_propfirm_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  rango_ventas TEXT NOT NULL,
  porcentaje_comision NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ib_propfirm_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read propfirm config" ON public.ib_propfirm_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage propfirm config" ON public.ib_propfirm_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 10. CPA distribution among users
CREATE TABLE public.ib_cpa_distribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  dolares_asignados NUMERIC NOT NULL,
  es_sub_ib BOOLEAN DEFAULT false,
  sub_ib_id UUID REFERENCES public.sub_ibs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ib_cpa_distribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read CPA distribution" ON public.ib_cpa_distribution FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage CPA distribution" ON public.ib_cpa_distribution FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 11. Reports (immutable)
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('technical', 'agreement', 'performance')),
  report_number TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  nombre_bd TEXT NOT NULL,
  nombre_ib TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read reports" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Report number generator
CREATE OR REPLACE FUNCTION public.generate_report_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
BEGIN
  prefix := CASE NEW.report_type
    WHEN 'technical' THEN 'TECH'
    WHEN 'agreement' THEN 'AGR'
    WHEN 'performance' THEN 'PERF'
  END;
  SELECT COALESCE(MAX(CAST(SUBSTRING(report_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO seq_num
    FROM public.reports
    WHERE report_type = NEW.report_type;
  NEW.report_number := prefix || '-' || LPAD(seq_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_report_number BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.generate_report_number();

-- 12. Storage bucket for reports
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);
CREATE POLICY "Authenticated can read reports files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reports');
CREATE POLICY "Admins can upload reports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports' AND public.has_role(auth.uid(), 'admin'));
