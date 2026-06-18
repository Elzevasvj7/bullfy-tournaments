
-- ========== AP: extend invoices with payment tracking ==========
ALTER TABLE public.accounting_invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.accounting_payment_methods(id);

ALTER TABLE public.accounting_invoices DROP CONSTRAINT IF EXISTS accounting_invoices_payment_status_check;
ALTER TABLE public.accounting_invoices
  ADD CONSTRAINT accounting_invoices_payment_status_check
  CHECK (payment_status IN ('unpaid','partial','paid','overdue','void'));

CREATE INDEX IF NOT EXISTS idx_inv_payment_status ON public.accounting_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_inv_due_date ON public.accounting_invoices(due_date);

-- ========== AR: Customer invoices ==========
CREATE TABLE IF NOT EXISTS public.accounting_ar_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_id text,
  email text,
  country_code text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_ar_customers TO authenticated;
GRANT ALL ON public.accounting_ar_customers TO service_role;
ALTER TABLE public.accounting_ar_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY ar_cust_select ON public.accounting_ar_customers FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer') OR has_role(auth.uid(),'directivo'));
CREATE POLICY ar_cust_write ON public.accounting_ar_customers FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant'));
CREATE POLICY ar_cust_update ON public.accounting_ar_customers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant'));
CREATE POLICY ar_cust_delete ON public.accounting_ar_customers FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin'));

CREATE TABLE IF NOT EXISTS public.accounting_ar_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.accounting_ar_customers(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  paid_at date,
  currency text NOT NULL REFERENCES public.accounting_currencies(code),
  amount numeric(18,4) NOT NULL,
  tax_amount numeric(18,4) NOT NULL DEFAULT 0,
  amount_usd numeric(18,4) NOT NULL,
  fx_rate numeric(18,8) NOT NULL DEFAULT 1,
  revenue_category_id uuid REFERENCES public.accounting_revenue_categories(id),
  revenue_source_id uuid REFERENCES public.accounting_revenue_sources(id),
  geography_id uuid REFERENCES public.accounting_geographies(id),
  cost_center_id uuid REFERENCES public.accounting_cost_centers(id),
  status text NOT NULL DEFAULT 'unpaid',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ar_inv_status_check CHECK (status IN ('draft','unpaid','partial','paid','overdue','void'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_ar_invoices TO authenticated;
GRANT ALL ON public.accounting_ar_invoices TO service_role;
ALTER TABLE public.accounting_ar_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY ar_inv_select ON public.accounting_ar_invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer') OR has_role(auth.uid(),'directivo'));
CREATE POLICY ar_inv_insert ON public.accounting_ar_invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant'));
CREATE POLICY ar_inv_update ON public.accounting_ar_invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant'));
CREATE POLICY ar_inv_delete ON public.accounting_ar_invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin'));

CREATE INDEX IF NOT EXISTS idx_ar_inv_status ON public.accounting_ar_invoices(status);
CREATE INDEX IF NOT EXISTS idx_ar_inv_due ON public.accounting_ar_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_inv_customer ON public.accounting_ar_invoices(customer_id);

-- ========== Bank reconciliation ==========
CREATE TABLE IF NOT EXISTS public.accounting_bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id uuid NOT NULL REFERENCES public.accounting_payment_methods(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  opening_balance numeric(18,4) NOT NULL DEFAULT 0,
  closing_balance numeric(18,4) NOT NULL DEFAULT 0,
  currency text NOT NULL REFERENCES public.accounting_currencies(code),
  file_name text,
  uploaded_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_stmt_status_check CHECK (status IN ('open','reconciled','closed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_bank_statements TO authenticated;
GRANT ALL ON public.accounting_bank_statements TO service_role;
ALTER TABLE public.accounting_bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_stmt_select ON public.accounting_bank_statements FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer') OR has_role(auth.uid(),'directivo'));
CREATE POLICY bank_stmt_write ON public.accounting_bank_statements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer'));

CREATE TABLE IF NOT EXISTS public.accounting_bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.accounting_bank_statements(id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  description text NOT NULL,
  reference text,
  amount numeric(18,4) NOT NULL,
  direction text NOT NULL,
  matched_type text,
  matched_id uuid,
  match_status text NOT NULL DEFAULT 'unmatched',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_line_dir_check CHECK (direction IN ('in','out')),
  CONSTRAINT bank_line_match_check CHECK (match_status IN ('unmatched','suggested','matched','ignored'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_bank_statement_lines TO authenticated;
GRANT ALL ON public.accounting_bank_statement_lines TO service_role;
ALTER TABLE public.accounting_bank_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_line_select ON public.accounting_bank_statement_lines FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer') OR has_role(auth.uid(),'directivo'));
CREATE POLICY bank_line_write ON public.accounting_bank_statement_lines FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer'));

CREATE INDEX IF NOT EXISTS idx_bank_line_stmt ON public.accounting_bank_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_line_match ON public.accounting_bank_statement_lines(match_status);

-- ========== AI Weekly Insights ==========
CREATE TABLE IF NOT EXISTS public.accounting_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at timestamptz NOT NULL DEFAULT now(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary text NOT NULL,
  anomalies jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  kpis jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  acknowledged_at timestamptz,
  acknowledged_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_ai_insights TO authenticated;
GRANT ALL ON public.accounting_ai_insights TO service_role;
ALTER TABLE public.accounting_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_ins_select ON public.accounting_ai_insights FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'treasurer') OR has_role(auth.uid(),'directivo'));
CREATE POLICY ai_ins_update ON public.accounting_ai_insights FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'global_admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'directivo'));

-- timestamps trigger
CREATE TRIGGER trg_ar_cust_updated BEFORE UPDATE ON public.accounting_ar_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ar_inv_updated BEFORE UPDATE ON public.accounting_ar_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
