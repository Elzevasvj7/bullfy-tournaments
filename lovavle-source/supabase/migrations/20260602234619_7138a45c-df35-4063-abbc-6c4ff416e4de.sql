
-- ============================================================================
-- Entidades legales
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  country_code TEXT,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_entities TO authenticated;
GRANT ALL ON public.accounting_entities TO service_role;

ALTER TABLE public.accounting_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_entities_read"
ON public.accounting_entities FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'directivo')
  OR public.has_role(auth.uid(), 'treasurer')
);

CREATE POLICY "accounting_entities_write"
ON public.accounting_entities FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
)
WITH CHECK (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
);

-- Añadir entity_id a gastos e ingresos (opcional)
ALTER TABLE public.accounting_expenses ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.accounting_entities(id);
ALTER TABLE public.accounting_revenues ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.accounting_entities(id);
ALTER TABLE public.accounting_treasury_transfers ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.accounting_entities(id);

-- ============================================================================
-- Activos fijos y depreciación
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES public.accounting_entities(id),
  name TEXT NOT NULL,
  description TEXT,
  asset_type TEXT NOT NULL DEFAULT 'equipment',
  acquisition_date DATE NOT NULL,
  acquisition_cost_original NUMERIC(18,2) NOT NULL,
  currency_original TEXT NOT NULL DEFAULT 'USD',
  fx_rate_to_usd NUMERIC(18,6) NOT NULL DEFAULT 1,
  acquisition_cost_usd NUMERIC(18,2) NOT NULL,
  useful_life_months INTEGER NOT NULL DEFAULT 36,
  salvage_value_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  disposal_date DATE,
  disposal_value_usd NUMERIC(18,2),
  expense_id UUID REFERENCES public.accounting_expenses(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_assets TO authenticated;
GRANT ALL ON public.accounting_assets TO service_role;
ALTER TABLE public.accounting_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_assets_read" ON public.accounting_assets FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'directivo')
);

CREATE POLICY "accounting_assets_write" ON public.accounting_assets FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
)
WITH CHECK (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
);

CREATE TABLE IF NOT EXISTS public.accounting_depreciation_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.accounting_assets(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  amount_usd NUMERIC(18,2) NOT NULL,
  accumulated_usd NUMERIC(18,2) NOT NULL,
  book_value_usd NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, period_year, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_depreciation_entries TO authenticated;
GRANT ALL ON public.accounting_depreciation_entries TO service_role;
ALTER TABLE public.accounting_depreciation_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_depreciation_read" ON public.accounting_depreciation_entries FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'directivo')
);

CREATE POLICY "accounting_depreciation_write" ON public.accounting_depreciation_entries FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
)
WITH CHECK (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
);

-- ============================================================================
-- Anomalías
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_anomalies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT NOT NULL,
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_anomalies TO authenticated;
GRANT ALL ON public.accounting_anomalies TO service_role;
ALTER TABLE public.accounting_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_anomalies_read" ON public.accounting_anomalies FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'directivo')
);

CREATE POLICY "accounting_anomalies_write" ON public.accounting_anomalies FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
)
WITH CHECK (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
);

-- ============================================================================
-- Notificaciones contables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_notifications TO authenticated;
GRANT ALL ON public.accounting_notifications TO service_role;
ALTER TABLE public.accounting_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_notifications_own_read" ON public.accounting_notifications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "accounting_notifications_own_update" ON public.accounting_notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "accounting_notifications_admin_insert" ON public.accounting_notifications FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
);

-- ============================================================================
-- Chat contable RAG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_chat_messages TO authenticated;
GRANT ALL ON public.accounting_chat_messages TO service_role;
ALTER TABLE public.accounting_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_chat_own" ON public.accounting_chat_messages FOR ALL TO authenticated
USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'global_admin')
)
WITH CHECK (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'global_admin')
);

CREATE INDEX IF NOT EXISTS idx_accounting_chat_session ON public.accounting_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_accounting_notifications_user ON public.accounting_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_anomalies_unresolved ON public.accounting_anomalies(resolved_at, severity);
CREATE INDEX IF NOT EXISTS idx_accounting_depreciation_period ON public.accounting_depreciation_entries(period_year, period_month);
