-- Payouts cripto a IBs vía NOWPayments + gate de aprobación del admin.
--
-- Añade a portal_withdrawal_requests:
--   - nowpayments_payout_id / nowpayments_response: referencia y respuesta del batch de payout.
--   - approved_at / approved_by: gate de aprobación del admin (los retiros REALES solo se
--     procesan después de que un admin los apruebe; los demo siguen siendo automáticos).
-- No toca datos existentes (todo IF NOT EXISTS).

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
