
-- TREASURY TRANSFERS
CREATE TABLE IF NOT EXISTS public.accounting_treasury_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL,
  recipient_user_id UUID NOT NULL,
  amount_original NUMERIC(18,4) NOT NULL CHECK (amount_original > 0),
  currency_original TEXT NOT NULL REFERENCES public.accounting_currencies(code),
  fx_rate_to_usd NUMERIC(20,10),
  amount_usd NUMERIC(18,4),
  transfer_date DATE NOT NULL,
  purpose TEXT NOT NULL,
  method TEXT,
  expected_category_id UUID REFERENCES public.accounting_expense_categories(id) ON DELETE SET NULL,
  geography_id UUID REFERENCES public.accounting_geographies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_sender_proof' CHECK (status IN (
    'pending_sender_proof','pending_recipient_receipt','partially_justified',
    'fully_justified','closed','disputed','returned'
  )),
  sender_proof_url TEXT,
  sender_proof_uploaded_at TIMESTAMPTZ,
  recipient_acknowledged_at TIMESTAMPTZ,
  amount_justified_usd NUMERIC(18,4) NOT NULL DEFAULT 0,
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  due_days INT DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_sender ON public.accounting_treasury_transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_tt_recipient ON public.accounting_treasury_transfers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_tt_status ON public.accounting_treasury_transfers(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_treasury_transfers TO authenticated;
GRANT ALL ON public.accounting_treasury_transfers TO service_role;
ALTER TABLE public.accounting_treasury_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tt_sel" ON public.accounting_treasury_transfers FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid() OR recipient_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'accountant'::app_role)
    OR public.has_role(auth.uid(),'treasurer'::app_role)
    OR public.has_role(auth.uid(),'directivo'::app_role)
  );
CREATE POLICY "tt_ins" ON public.accounting_treasury_transfers FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND (public.has_role(auth.uid(),'treasurer'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  );
CREATE POLICY "tt_upd" ON public.accounting_treasury_transfers FOR UPDATE TO authenticated
  USING (
    sender_user_id = auth.uid() OR recipient_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role)
  );
CREATE POLICY "tt_del" ON public.accounting_treasury_transfers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- Trigger: FX + updated_at
CREATE OR REPLACE FUNCTION public.accounting_set_fx_transfer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.fx_rate_to_usd IS NULL THEN
    NEW.fx_rate_to_usd := public.get_fx_to_usd(NEW.currency_original, NEW.transfer_date);
  END IF;
  NEW.amount_usd := ROUND(NEW.amount_original * NEW.fx_rate_to_usd, 4);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tt_fx ON public.accounting_treasury_transfers;
CREATE TRIGGER trg_tt_fx BEFORE INSERT OR UPDATE ON public.accounting_treasury_transfers
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_fx_transfer();

-- TRANSFER NOTES (chat bidireccional)
CREATE TABLE IF NOT EXISTS public.accounting_treasury_transfer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.accounting_treasury_transfers(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  note TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ttn_transfer ON public.accounting_treasury_transfer_notes(transfer_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.accounting_treasury_transfer_notes TO authenticated;
GRANT ALL ON public.accounting_treasury_transfer_notes TO service_role;
ALTER TABLE public.accounting_treasury_transfer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ttn_sel" ON public.accounting_treasury_transfer_notes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.accounting_treasury_transfers t WHERE t.id = transfer_id
    AND (t.sender_user_id = auth.uid() OR t.recipient_user_id = auth.uid()
      OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
  ));
CREATE POLICY "ttn_ins" ON public.accounting_treasury_transfer_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accounting_treasury_transfers t WHERE t.id = transfer_id
      AND (t.sender_user_id = auth.uid() OR t.recipient_user_id = auth.uid()
        OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
    )
  );
CREATE POLICY "ttn_del" ON public.accounting_treasury_transfer_notes FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role));

-- TRANSFER ↔ EXPENSES (N:N)
CREATE TABLE IF NOT EXISTS public.accounting_treasury_transfer_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.accounting_treasury_transfers(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.accounting_expenses(id) ON DELETE CASCADE,
  amount_applied_usd NUMERIC(18,4) NOT NULL CHECK (amount_applied_usd > 0),
  applied_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, expense_id)
);
CREATE INDEX IF NOT EXISTS idx_tte_transfer ON public.accounting_treasury_transfer_expenses(transfer_id);
CREATE INDEX IF NOT EXISTS idx_tte_expense ON public.accounting_treasury_transfer_expenses(expense_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_treasury_transfer_expenses TO authenticated;
GRANT ALL ON public.accounting_treasury_transfer_expenses TO service_role;
ALTER TABLE public.accounting_treasury_transfer_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tte_sel" ON public.accounting_treasury_transfer_expenses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.accounting_treasury_transfers t WHERE t.id = transfer_id
    AND (t.sender_user_id = auth.uid() OR t.recipient_user_id = auth.uid()
      OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role) OR public.has_role(auth.uid(),'directivo'::app_role))
  ));
CREATE POLICY "tte_ins" ON public.accounting_treasury_transfer_expenses FOR INSERT TO authenticated
  WITH CHECK (
    applied_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accounting_treasury_transfers t WHERE t.id = transfer_id
      AND (t.recipient_user_id = auth.uid() OR t.sender_user_id = auth.uid()
        OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role))
    )
  );
CREATE POLICY "tte_upd" ON public.accounting_treasury_transfer_expenses FOR UPDATE TO authenticated
  USING (applied_by = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));
CREATE POLICY "tte_del" ON public.accounting_treasury_transfer_expenses FOR DELETE TO authenticated
  USING (applied_by = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'global_admin'::app_role) OR public.has_role(auth.uid(),'accountant'::app_role));

-- Trigger: recalcula amount_justified_usd y avanza status
CREATE OR REPLACE FUNCTION public.accounting_recalc_transfer_justified()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer_id UUID;
  v_total NUMERIC;
  v_transfer RECORD;
  v_expense_usd NUMERIC;
  v_sum_applied NUMERIC;
BEGIN
  v_transfer_id := COALESCE(NEW.transfer_id, OLD.transfer_id);

  -- Validar que la suma aplicada al gasto no exceda su monto USD
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT amount_usd INTO v_expense_usd FROM public.accounting_expenses WHERE id = NEW.expense_id;
    SELECT COALESCE(SUM(amount_applied_usd),0) INTO v_sum_applied
      FROM public.accounting_treasury_transfer_expenses
      WHERE expense_id = NEW.expense_id AND id <> COALESCE(NEW.id, gen_random_uuid());
    IF (v_sum_applied + NEW.amount_applied_usd) > COALESCE(v_expense_usd,0) + 0.01 THEN
      RAISE EXCEPTION 'La suma aplicada (%) excede el monto del gasto (%)', v_sum_applied + NEW.amount_applied_usd, v_expense_usd;
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount_applied_usd),0) INTO v_total
    FROM public.accounting_treasury_transfer_expenses
    WHERE transfer_id = v_transfer_id;

  SELECT * INTO v_transfer FROM public.accounting_treasury_transfers WHERE id = v_transfer_id;

  IF v_total > COALESCE(v_transfer.amount_usd,0) + 0.01 THEN
    RAISE EXCEPTION 'La justificación total (%) excede el envío (%)', v_total, v_transfer.amount_usd;
  END IF;

  UPDATE public.accounting_treasury_transfers SET
    amount_justified_usd = v_total,
    status = CASE
      WHEN status IN ('closed','disputed','returned') THEN status
      WHEN v_total >= COALESCE(amount_usd,0) - 0.01 THEN 'fully_justified'
      WHEN v_total > 0 THEN 'partially_justified'
      ELSE status
    END,
    updated_at = now()
  WHERE id = v_transfer_id;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_tte_recalc ON public.accounting_treasury_transfer_expenses;
CREATE TRIGGER trg_tte_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.accounting_treasury_transfer_expenses
  FOR EACH ROW EXECUTE FUNCTION public.accounting_recalc_transfer_justified();

-- Realtime on notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounting_treasury_transfer_notes;
