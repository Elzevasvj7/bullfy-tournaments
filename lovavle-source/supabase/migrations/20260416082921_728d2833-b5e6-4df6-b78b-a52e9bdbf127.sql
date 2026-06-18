
CREATE TABLE public.portal_payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.portal_orders(id) ON DELETE SET NULL,
  portal_id UUID NOT NULL,
  partner_user_id UUID,
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'coinsbuy')),
  gateway_action TEXT NOT NULL,
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'usd',
  gateway_reference_id TEXT,
  request_payload JSONB,
  response_payload JSONB,
  http_status INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_payment_transactions ENABLE ROW LEVEL SECURITY;

-- Public read for portal clients and admin monitoring
CREATE POLICY "Anyone can read payment transactions"
ON public.portal_payment_transactions FOR SELECT USING (true);

-- Index for quick lookups
CREATE INDEX idx_ppt_order_id ON public.portal_payment_transactions(order_id);
CREATE INDEX idx_ppt_portal_id ON public.portal_payment_transactions(portal_id);
CREATE INDEX idx_ppt_created_at ON public.portal_payment_transactions(created_at DESC);
