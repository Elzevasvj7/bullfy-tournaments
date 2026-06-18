-- ============================================================================
-- C7 — Notificación de expiración de suscripciones (anti-duplicado)
-- ----------------------------------------------------------------------------
-- Columna para registrar cuándo se notificó al usuario que su suscripción está
-- por vencer, y así NO reenviar el aviso cada día que corre el cron dentro de
-- la misma ventana. El cron (notify-expiring-subscriptions) solo notifica si
-- expiry_notified_at es NULL o es anterior al periodo actual.
-- Idempotente.
-- ============================================================================
ALTER TABLE public.trading_room_subscriptions
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;
