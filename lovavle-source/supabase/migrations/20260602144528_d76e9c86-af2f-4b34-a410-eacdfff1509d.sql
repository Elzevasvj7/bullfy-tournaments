ALTER TABLE public.portal_withdrawal_requests
  ADD COLUMN IF NOT EXISTS nowpayments_payout_id TEXT;
ALTER TABLE public.portal_withdrawal_requests
  ADD COLUMN IF NOT EXISTS nowpayments_response JSONB;
ALTER TABLE public.portal_withdrawal_requests
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.portal_withdrawal_requests
  ADD COLUMN IF NOT EXISTS approved_by UUID;

CREATE INDEX IF NOT EXISTS idx_wd_nowpayments_payout_id
  ON public.portal_withdrawal_requests(nowpayments_payout_id);