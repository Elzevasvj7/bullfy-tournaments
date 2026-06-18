-- Amplía el CHECK de portal_payment_transactions.gateway para permitir 'nowpayments'.
--
-- Contexto: el CHECK original solo aceptaba ('stripe','coinsbuy'), así que el
-- logTransaction de NOWPayments fallaba en silencio (el cobro/invoice se creaba
-- igual porque la llamada a la pasarela es independiente, pero el registro en
-- portal_payment_transactions —create_invoice y callback_received— se rechazaba,
-- dejándonos sin trazabilidad). Esta migración no toca datos; solo redefine el
-- constraint para incluir los gateways realmente usados.
--
-- Robusta ante el nombre del constraint: elimina cualquier CHECK existente sobre
-- la columna gateway (independientemente de su nombre) y crea el nuevo. Idempotente.

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.portal_payment_transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%gateway%'
  LOOP
    EXECUTE format('ALTER TABLE public.portal_payment_transactions DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.portal_payment_transactions
  ADD CONSTRAINT portal_payment_transactions_gateway_check
  CHECK (gateway IN ('stripe', 'stripe_gateway', 'coinsbuy', 'nowpayments', 'demo', 'simulated'));
