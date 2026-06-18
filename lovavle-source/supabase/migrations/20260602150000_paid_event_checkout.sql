-- ============================================================================
-- Checkout de EVENTOS PAGOS — ligar la orden al evento
-- ----------------------------------------------------------------------------
-- Para inscribir a un usuario a un evento de pago hace falta saber, al confirmar
-- el pago, a qué evento corresponde la orden. Se añade portal_orders.event_id
-- (nullable; las órdenes de tienda/trading-room lo dejan NULL). Al marcarse la
-- orden 'paid', las edge functions (coinsbuy-callback / verify_payment) insertan
-- la inscripción en portal_event_registrations (granted_by='paid'), idempotente.
-- Aditiva e idempotente.
-- ============================================================================
ALTER TABLE public.portal_orders
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.portal_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portal_orders_event ON public.portal_orders(event_id);
