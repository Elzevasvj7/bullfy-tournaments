-- Tabla de pagos NowPayments
CREATE TABLE public.nowpayments_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT,
  payment_id TEXT UNIQUE,
  order_id TEXT,
  order_description TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  price_amount NUMERIC,
  price_currency TEXT,
  pay_amount NUMERIC,
  pay_currency TEXT,
  pay_address TEXT,
  actually_paid NUMERIC,
  user_id UUID,
  portal_id UUID,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  purpose TEXT,
  invoice_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nowpayments_payments_user ON public.nowpayments_payments(user_id);
CREATE INDEX idx_nowpayments_payments_status ON public.nowpayments_payments(status);
CREATE INDEX idx_nowpayments_payments_invoice ON public.nowpayments_payments(invoice_id);
CREATE INDEX idx_nowpayments_payments_order ON public.nowpayments_payments(order_id);

ALTER TABLE public.nowpayments_payments ENABLE ROW LEVEL SECURITY;

-- Solo admins y global_admin pueden ver/gestionar
CREATE POLICY "Admins can view nowpayments payments"
ON public.nowpayments_payments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins can insert nowpayments payments"
ON public.nowpayments_payments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins can update nowpayments payments"
ON public.nowpayments_payments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

-- Trigger updated_at
CREATE TRIGGER update_nowpayments_payments_updated_at
BEFORE UPDATE ON public.nowpayments_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();