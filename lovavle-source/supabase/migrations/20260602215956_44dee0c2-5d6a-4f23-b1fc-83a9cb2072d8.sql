
-- BUDGETS
CREATE TABLE IF NOT EXISTS public.accounting_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' REFERENCES public.accounting_currencies(code),
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','category','geography','cost_center','user')),
  scope_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_budgets TO authenticated;
GRANT ALL ON public.accounting_budgets TO service_role;
ALTER TABLE public.accounting_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bg_sel" ON public.accounting_budgets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'directivo'::app_role));
CREATE POLICY "bg_wr" ON public.accounting_budgets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- BUDGET LINES
CREATE TABLE IF NOT EXISTS public.accounting_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.accounting_budgets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.accounting_expense_categories(id) ON DELETE SET NULL,
  geography_id UUID REFERENCES public.accounting_geographies(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.accounting_cost_centers(id) ON DELETE SET NULL,
  amount_planned_usd NUMERIC(18,4) NOT NULL CHECK (amount_planned_usd >= 0),
  period_granularity TEXT NOT NULL DEFAULT 'monthly' CHECK (period_granularity IN ('monthly','quarterly','yearly')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bl_budget ON public.accounting_budget_lines(budget_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_budget_lines TO authenticated;
GRANT ALL ON public.accounting_budget_lines TO service_role;
ALTER TABLE public.accounting_budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bl_sel" ON public.accounting_budget_lines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'directivo'::app_role));
CREATE POLICY "bl_wr" ON public.accounting_budget_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- BUDGET ALERTS
CREATE TABLE IF NOT EXISTS public.accounting_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id UUID NOT NULL REFERENCES public.accounting_budget_lines(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  message TEXT NOT NULL,
  planned_usd NUMERIC(18,4),
  actual_usd NUMERIC(18,4),
  variance_pct NUMERIC(10,2),
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ba_line ON public.accounting_budget_alerts(budget_line_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_budget_alerts TO authenticated;
GRANT ALL ON public.accounting_budget_alerts TO service_role;
ALTER TABLE public.accounting_budget_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ba_sel" ON public.accounting_budget_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'directivo'::app_role));
CREATE POLICY "ba_wr" ON public.accounting_budget_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- FUNCTION: get_budget_variances - calcula plan vs real
CREATE OR REPLACE FUNCTION public.get_budget_variances(_budget_id UUID)
RETURNS TABLE (
  budget_line_id UUID,
  category_id UUID,
  category_name TEXT,
  geography_id UUID,
  cost_center_id UUID,
  planned_usd NUMERIC,
  actual_usd NUMERIC,
  variance_usd NUMERIC,
  variance_pct NUMERIC,
  status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  SELECT period_start, period_end INTO v_period_start, v_period_end
    FROM public.accounting_budgets WHERE id = _budget_id;

  RETURN QUERY
  SELECT
    bl.id,
    bl.category_id,
    c.name,
    bl.geography_id,
    bl.cost_center_id,
    bl.amount_planned_usd,
    COALESCE(SUM(e.amount_usd),0)::NUMERIC AS actual,
    (COALESCE(SUM(e.amount_usd),0) - bl.amount_planned_usd)::NUMERIC AS var_usd,
    CASE WHEN bl.amount_planned_usd > 0 THEN
      ROUND(((COALESCE(SUM(e.amount_usd),0) - bl.amount_planned_usd) / bl.amount_planned_usd * 100)::numeric, 2)
    ELSE NULL END AS var_pct,
    CASE
      WHEN bl.amount_planned_usd = 0 THEN 'no_plan'
      WHEN COALESCE(SUM(e.amount_usd),0) < bl.amount_planned_usd * 0.95 THEN 'under'
      WHEN COALESCE(SUM(e.amount_usd),0) <= bl.amount_planned_usd * 1.05 THEN 'on_track'
      WHEN COALESCE(SUM(e.amount_usd),0) <= bl.amount_planned_usd * 1.20 THEN 'over'
      ELSE 'critical'
    END
  FROM public.accounting_budget_lines bl
  LEFT JOIN public.accounting_expense_categories c ON c.id = bl.category_id
  LEFT JOIN public.accounting_expenses e ON
    e.expense_date BETWEEN v_period_start AND v_period_end
    AND (bl.category_id IS NULL OR e.category_id = bl.category_id)
    AND (bl.geography_id IS NULL OR e.geography_id = bl.geography_id)
    AND (bl.cost_center_id IS NULL OR e.cost_center_id = bl.cost_center_id)
    AND e.status <> 'void'
  WHERE bl.budget_id = _budget_id
  GROUP BY bl.id, bl.category_id, c.name, bl.geography_id, bl.cost_center_id, bl.amount_planned_usd;
END $$;

GRANT EXECUTE ON FUNCTION public.get_budget_variances(UUID) TO authenticated;

-- Updated_at trigger for budgets
DROP TRIGGER IF EXISTS trg_bg_touch ON public.accounting_budgets;
CREATE TRIGGER trg_bg_touch BEFORE UPDATE ON public.accounting_budgets
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_updated_at();
