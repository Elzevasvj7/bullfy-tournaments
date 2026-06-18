insert into wallet_movements (
  id,
  trader_id,
  payment_intent_id,
  movement_type,
  status,
  amount_usd,
  currency,
  title,
  description,
  metadata,
  created_at
)
select
  concat('mov_', md5(pi.id)),
  pi.trader_id,
  pi.id,
  'topup',
  case
    when pi.status = 'completed' then 'completed'
    when pi.status in ('failed', 'expired', 'cancelled') then 'failed'
    else 'pending'
  end,
  pi.amount_usd,
  'USD',
  'Recarga NOWPayments',
  case
    when pi.status = 'completed' then 'Recarga acreditada al balance real.'
    when pi.status in ('failed', 'expired', 'cancelled') then 'Pago no acreditado.'
    when pi.provider_invoice_id is not null then 'Invoice creado. Esperando pago confirmado.'
    else 'Pago iniciado. Esperando confirmacion de la pasarela.'
  end,
  jsonb_build_object(
    'backfilled', true,
    'provider', pi.provider,
    'providerInvoiceId', pi.provider_invoice_id,
    'providerPaymentId', pi.provider_payment_id,
    'providerStatus', pi.provider_status
  ),
  pi.created_at
from payment_intents pi
where pi.purpose = 'wallet_topup'
  and not exists (
    select 1
    from wallet_movements wm
    where wm.payment_intent_id = pi.id
      and wm.movement_type = 'topup'
  );
