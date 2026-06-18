-- ============================================================================
-- Habilitar retiros USDT vía NOWPayments (Coinsbuy queda apagado)
-- ----------------------------------------------------------------------------
-- El trigger trg_block_usdt_withdrawal bloqueaba payout_method='usdt_trc20' porque
-- el payout cripto original (Coinsbuy) era un placeholder. Ahora el payout USDT se
-- procesa por NOWPayments (processNowpaymentsPayout en mlm-withdrawal-process), con
-- aprobación del admin (mlm-withdrawal-review) antes de procesar. Por tanto se
-- RETIRA el bloqueo para que NOWPayments y Stripe convivan como métodos de retiro.
-- El frontend ya tiene USDT_WITHDRAWAL_ENABLED = true. Idempotente.
-- ============================================================================
DROP TRIGGER IF EXISTS trg_block_usdt_withdrawal ON public.portal_withdrawal_requests;
DROP FUNCTION IF EXISTS public.block_usdt_withdrawal();
