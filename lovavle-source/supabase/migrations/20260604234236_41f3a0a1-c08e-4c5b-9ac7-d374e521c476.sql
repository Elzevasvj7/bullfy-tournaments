
-- 1. Cards table
CREATE TABLE public.accounting_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_type text NOT NULL CHECK (card_type IN ('debit','credit')),
  brand text NOT NULL DEFAULT 'other' CHECK (brand IN ('visa','mastercard','amex','other')),
  bank text,
  alias text NOT NULL,
  last4 varchar(4) NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
  currency text NOT NULL DEFAULT 'USD',
  credit_limit numeric,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_cards TO authenticated;
GRANT ALL ON public.accounting_cards TO service_role;

ALTER TABLE public.accounting_cards ENABLE ROW LEVEL SECURITY;

-- Owners can view their own cards
CREATE POLICY "Users view own cards" ON public.accounting_cards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Accounting roles can view all
CREATE POLICY "Accounting view all cards" ON public.accounting_cards
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role)
    OR public.has_role(auth.uid(),'directivo'::app_role)
  );

-- Manage (insert/update/delete) only accounting/admin
CREATE POLICY "Accounting manage cards" ON public.accounting_cards
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role)
  );

CREATE INDEX idx_accounting_cards_user ON public.accounting_cards(user_id) WHERE is_active = true;

CREATE TRIGGER trg_accounting_cards_updated
  BEFORE UPDATE ON public.accounting_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Link columns
ALTER TABLE public.accounting_invoices ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.accounting_cards(id) ON DELETE SET NULL;
ALTER TABLE public.accounting_expenses ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.accounting_cards(id) ON DELETE SET NULL;

-- 3. Extend approve_invoice_to_expense with p_card_id
DROP FUNCTION IF EXISTS public.approve_invoice_to_expense(uuid, uuid, uuid, uuid, uuid, uuid, text, date, text, uuid);

CREATE OR REPLACE FUNCTION public.approve_invoice_to_expense(
  p_invoice_id uuid,
  p_category_id uuid,
  p_geography_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_expense_date date DEFAULT NULL,
  p_funding_source text DEFAULT 'corporate_card',
  p_payment_method_id uuid DEFAULT NULL,
  p_card_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.accounting_invoices%ROWTYPE;
  v_expense_id uuid;
  v_caller uuid := auth.uid();
  v_desc text;
  v_date date;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_funding_source NOT IN ('corporate_card','treasury_advance','own_money_reimbursable') THEN
    RAISE EXCEPTION 'invalid funding_source';
  END IF;

  SELECT * INTO v_inv FROM public.accounting_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF v_inv.amount_original IS NULL OR v_inv.currency_original IS NULL THEN
    RAISE EXCEPTION 'invoice missing amount/currency — escanear OCR primero';
  END IF;

  v_desc := COALESCE(NULLIF(trim(p_description), ''),
            'Factura ' || COALESCE(v_inv.invoice_number,'—') || ' / ' || COALESCE(v_inv.vendor_name,'proveedor'));
  v_date := COALESCE(p_expense_date, v_inv.issue_date, CURRENT_DATE);

  SELECT id INTO v_expense_id FROM public.accounting_expenses WHERE invoice_id = p_invoice_id LIMIT 1;
  IF v_expense_id IS NULL THEN
    INSERT INTO public.accounting_expenses (
      description, expense_date, amount_original, currency_original,
      category_id, geography_id, cost_center_id, vendor_id, user_id,
      invoice_id, entity_id, status, funding_source, payment_method_id, card_id, created_by
    ) VALUES (
      v_desc, v_date, v_inv.amount_original, v_inv.currency_original,
      p_category_id, p_geography_id, p_cost_center_id, v_inv.vendor_id, p_user_id,
      p_invoice_id, p_entity_id, 'recorded', p_funding_source, p_payment_method_id, p_card_id, v_caller
    ) RETURNING id INTO v_expense_id;
  ELSE
    UPDATE public.accounting_expenses
      SET funding_source = p_funding_source,
          payment_method_id = COALESCE(p_payment_method_id, payment_method_id),
          card_id = COALESCE(p_card_id, card_id),
          description = v_desc
      WHERE id = v_expense_id;
  END IF;

  UPDATE public.accounting_invoices
    SET status='approved', reviewed_by=v_caller, reviewed_at=now(),
        card_id = COALESCE(p_card_id, card_id),
        updated_at=now()
    WHERE id = p_invoice_id;

  INSERT INTO public.accounting_audit_log(actor_user_id, entity, entity_id, action, before_data, after_data)
  VALUES (v_caller, 'accounting_invoices', p_invoice_id, 'approve',
          jsonb_build_object('status', v_inv.status),
          jsonb_build_object('status','approved','expense_id', v_expense_id, 'funding_source', p_funding_source, 'payment_method_id', p_payment_method_id, 'card_id', p_card_id));

  RETURN v_expense_id;
END $function$;
