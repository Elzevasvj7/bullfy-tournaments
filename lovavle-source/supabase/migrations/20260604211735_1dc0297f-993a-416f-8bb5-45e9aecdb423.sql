-- Extend approve_invoice_to_expense to accept payment_method_id
DROP FUNCTION IF EXISTS public.approve_invoice_to_expense(uuid, uuid, uuid, uuid, uuid, uuid, text, date);

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
  p_payment_method_id uuid DEFAULT NULL
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
      invoice_id, entity_id, status, funding_source, payment_method_id, created_by
    ) VALUES (
      v_desc, v_date, v_inv.amount_original, v_inv.currency_original,
      p_category_id, p_geography_id, p_cost_center_id, v_inv.vendor_id, p_user_id,
      p_invoice_id, p_entity_id, 'recorded', p_funding_source, p_payment_method_id, v_caller
    ) RETURNING id INTO v_expense_id;
  ELSE
    UPDATE public.accounting_expenses
      SET funding_source = p_funding_source,
          payment_method_id = COALESCE(p_payment_method_id, payment_method_id),
          description = v_desc
      WHERE id = v_expense_id;
  END IF;

  UPDATE public.accounting_invoices
    SET status='approved', reviewed_by=v_caller, reviewed_at=now(), updated_at=now()
    WHERE id = p_invoice_id;

  INSERT INTO public.accounting_audit_log(actor_user_id, entity, entity_id, action, before_data, after_data)
  VALUES (v_caller, 'accounting_invoices', p_invoice_id, 'approve',
          jsonb_build_object('status', v_inv.status),
          jsonb_build_object('status','approved','expense_id', v_expense_id, 'funding_source', p_funding_source, 'payment_method_id', p_payment_method_id));

  RETURN v_expense_id;
END $function$;