// ============================================================================
// Configuración de métodos de pago del lado del cliente.
// ----------------------------------------------------------------------------
// CARD_PAYMENT_ENABLED — controla si el checkout ofrece pago con tarjeta (Stripe).
//
// Estado: el flujo Stripe YA está reconstruido de forma segura:
//   • portal-commerce crea una Checkout Session hospedada (NO marca 'paid' al iniciar).
//   • La confirmación REAL llega por la Edge Function stripe-webhook (firma Stripe +
//     verificación server-to-server), que finaliza la orden idempotente.
//   • release_due_portal_owner_commissions ya acredita gateway 'stripe_gateway' al IB.
//
// Sigue en `false` (la tarjeta no se ofrece en la UI) hasta completar y VALIDAR en prod:
//   1) Pegar las llaves LIVE de Stripe (pk_live_ / sk_live_) en Configuración › Pasarelas.
//   2) Registrar el webhook en Stripe (URL .../functions/v1/stripe-webhook) y pegar el
//      Webhook Signing Secret (whsec_) en esa misma pantalla; activar la pasarela.
//   3) Hacer un cobro de prueba real y confirmar que la orden pasa a 'paid' y el IB
//      recibe su comisión.
// Hecho eso, poner CARD_PAYMENT_ENABLED = true.
//
// ACTIVADO: llaves LIVE pegadas + pasarela activa + webhook registrado. El pago con
// tarjeta (Stripe) convive con el pago en cripto (NOWPayments). Coinsbuy queda apagado.
// ============================================================================
export const CARD_PAYMENT_ENABLED = true;
