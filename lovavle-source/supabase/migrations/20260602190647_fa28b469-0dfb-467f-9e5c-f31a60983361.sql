-- ── Borrado total de órdenes 'pending' (nunca pagadas) y todo su rastro ──
-- Las órdenes pendientes son checkouts iniciados que nunca se cobraron. NO generaron
-- comisiones, ledger, accesos ni inscripciones (eso solo ocurre al marcarse 'paid'),
-- así que el borrado es de bajo riesgo. Se eliminan también los hijos con FK SET NULL
-- (payment_transactions, mlm_commissions) y sin cascade para no dejar huérfanos. El
-- usuario pidió NO conservar historial de estas.
--
-- Las órdenes PAGADAS (incl. las test de stripe_gateway, cuyas ganancias ya se anularon
-- en 20260602260000) NO se tocan aquí.

-- Hijos primero (los que no cascaden / SET NULL), luego las órdenes.
DELETE FROM public.portal_payment_transactions
 WHERE order_id IN (SELECT id FROM public.portal_orders WHERE payment_status = 'pending');

DELETE FROM public.financial_events
 WHERE order_id IN (SELECT id FROM public.portal_orders WHERE payment_status = 'pending');

DELETE FROM public.portal_commissions
 WHERE order_id IN (SELECT id FROM public.portal_orders WHERE payment_status = 'pending');

DELETE FROM public.portal_mlm_commissions
 WHERE order_id IN (SELECT id FROM public.portal_orders WHERE payment_status = 'pending');

DELETE FROM public.portal_ledger
 WHERE order_id IN (SELECT id FROM public.portal_orders WHERE payment_status = 'pending');

DELETE FROM public.portal_order_items
 WHERE order_id IN (SELECT id FROM public.portal_orders WHERE payment_status = 'pending');

DELETE FROM public.portal_orders
 WHERE payment_status = 'pending';