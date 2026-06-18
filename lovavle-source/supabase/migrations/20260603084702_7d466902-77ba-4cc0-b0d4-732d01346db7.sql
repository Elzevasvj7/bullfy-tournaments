
-- Columnas
ALTER TABLE public.accounting_expenses
  ADD COLUMN IF NOT EXISTS funding_source text
    CHECK (funding_source IN ('corporate_card','treasury_advance','own_money_reimbursable')),
  ADD COLUMN IF NOT EXISTS reimbursement_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (reimbursement_status IN ('not_applicable','pending','reimbursed')),
  ADD COLUMN IF NOT EXISTS reimbursed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reimbursed_by uuid;

CREATE INDEX IF NOT EXISTS idx_acc_expenses_funding_source ON public.accounting_expenses(funding_source);
CREATE INDEX IF NOT EXISTS idx_acc_expenses_reimb_status ON public.accounting_expenses(reimbursement_status);

-- Trigger: mantener reimbursement_status coherente con funding_source
CREATE OR REPLACE FUNCTION public.fn_expense_sync_reimbursement_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.funding_source = 'own_money_reimbursable' THEN
    IF NEW.reimbursement_status = 'not_applicable' THEN
      NEW.reimbursement_status := 'pending';
    END IF;
  ELSE
    IF NEW.reimbursement_status <> 'not_applicable' AND
       (TG_OP='INSERT' OR OLD.funding_source IS DISTINCT FROM NEW.funding_source) THEN
      NEW.reimbursement_status := 'not_applicable';
      NEW.reimbursed_at := NULL;
      NEW.reimbursed_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_expense_sync_reimbursement_status ON public.accounting_expenses;
CREATE TRIGGER trg_expense_sync_reimbursement_status
  BEFORE INSERT OR UPDATE OF funding_source ON public.accounting_expenses
  FOR EACH ROW EXECUTE FUNCTION public.fn_expense_sync_reimbursement_status();

-- RPC actualizada con funding_source
CREATE OR REPLACE FUNCTION public.approve_invoice_to_expense(
  p_invoice_id uuid,
  p_category_id uuid,
  p_geography_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_expense_date date DEFAULT NULL,
  p_funding_source text DEFAULT 'corporate_card'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      invoice_id, entity_id, status, funding_source, created_by
    ) VALUES (
      v_desc, v_date, v_inv.amount_original, v_inv.currency_original,
      p_category_id, p_geography_id, p_cost_center_id, v_inv.vendor_id, p_user_id,
      p_invoice_id, p_entity_id, 'recorded', p_funding_source, v_caller
    ) RETURNING id INTO v_expense_id;
  ELSE
    UPDATE public.accounting_expenses
      SET funding_source = p_funding_source
      WHERE id = v_expense_id;
  END IF;

  UPDATE public.accounting_invoices
    SET status='approved', reviewed_by=v_caller, reviewed_at=now(), updated_at=now()
    WHERE id = p_invoice_id;

  INSERT INTO public.accounting_audit_log(actor_user_id, entity, entity_id, action, before_data, after_data)
  VALUES (v_caller, 'accounting_invoices', p_invoice_id, 'approve',
          jsonb_build_object('status', v_inv.status),
          jsonb_build_object('status','approved','expense_id', v_expense_id, 'funding_source', p_funding_source));

  RETURN v_expense_id;
END $$;

REVOKE ALL ON FUNCTION public.approve_invoice_to_expense(uuid,uuid,uuid,uuid,uuid,uuid,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_invoice_to_expense(uuid,uuid,uuid,uuid,uuid,uuid,text,date,text) TO authenticated;

-- Trigger fallback: si una factura se aprueba por otra vía y crea expense, default 'corporate_card'
CREATE OR REPLACE FUNCTION public.fn_invoice_approved_autoexpense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_geo uuid; v_exists boolean;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='approved' THEN RETURN NEW; END IF;
  IF NEW.amount_original IS NULL OR NEW.currency_original IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM public.accounting_expenses WHERE invoice_id=NEW.id) INTO v_exists;
  IF v_exists THEN RETURN NEW; END IF;
  SELECT id INTO v_cat FROM public.accounting_expense_categories WHERE name='Otros' LIMIT 1;
  SELECT id INTO v_geo FROM public.accounting_geographies WHERE name='Global' LIMIT 1;
  INSERT INTO public.accounting_expenses(
    description, expense_date, amount_original, currency_original,
    category_id, geography_id, vendor_id, invoice_id, status, funding_source, created_by
  ) VALUES (
    'Factura ' || COALESCE(NEW.invoice_number,'—') || ' / ' || COALESCE(NEW.vendor_name,'proveedor'),
    COALESCE(NEW.issue_date, CURRENT_DATE),
    NEW.amount_original, NEW.currency_original,
    v_cat, v_geo, NEW.vendor_id, NEW.id, 'recorded', 'corporate_card',
    COALESCE(NEW.reviewed_by, NEW.uploaded_by)
  );
  RETURN NEW;
END $$;

-- RPC para marcar reembolso completado
CREATE OR REPLACE FUNCTION public.mark_expense_reimbursed(p_expense_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.accounting_expenses
    SET reimbursement_status='reimbursed', reimbursed_at=now(), reimbursed_by=v_caller
    WHERE id = p_expense_id AND funding_source='own_money_reimbursable';
END $$;

REVOKE ALL ON FUNCTION public.mark_expense_reimbursed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_expense_reimbursed(uuid) TO authenticated;
