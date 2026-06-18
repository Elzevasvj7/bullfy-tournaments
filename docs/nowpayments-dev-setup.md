# NOWPayments sandbox para recarga de wallet

Este proyecto ya tiene una primera integracion server-side de NOWPayments para
recargar el balance real USD del usuario demo.

## Flujo implementado

1. El usuario abre `/wallet` y pulsa `Recargar con crypto`.
2. El browser llama `POST /api/wallet/topup/nowpayments`.
3. El server crea un `payment_intent` local por `$20.00 USD`.
4. El server crea un movimiento `pending` en `wallet_movements` para que el
   historial muestre la recarga desde el inicio.
5. El server crea un invoice en NOWPayments sandbox.
6. El usuario es redirigido al `invoice_url` de NOWPayments.
7. NOWPayments llama `POST /api/webhooks/nowpayments`.
8. El webhook valida `x-nowpayments-sig`.
9. Si el pago llega como `confirmed` o `finished`, se acredita el balance real
   USD y el movimiento pasa a `completed`. Si llega como `failed`, `expired` o
   `refunded`, el movimiento pasa a `failed` y no se acredita saldo.

## Variables necesarias

```env
NEXT_PUBLIC_APP_URL=https://tu-tunel-publico.ngrok-free.app
NOWPAYMENTS_ENV=sandbox
NOWPAYMENTS_API_KEY=tu-api-key-sandbox
NOWPAYMENTS_IPN_SECRET=tu-ipn-secret-sandbox
NOWPAYMENTS_TOPUP_AMOUNT_USD=20
```

`NEXT_PUBLIC_APP_URL` no puede ser `localhost` si quieres probar webhooks reales.
Debe apuntar a una URL publica que llegue a tu Next dev server.

`NOWPAYMENTS_IPN_SECRET` es obligatorio para acreditar saldo. El redirect a
`success_url` no se usa como prueba de pago porque puede abrirse manualmente; la
confirmacion confiable para saldo viene del webhook firmado.

## Setup local recomendado

```powershell
pnpm db:up
pnpm db:migrate
pnpm dev
```

En otra terminal:

```powershell
ngrok http 3000
```

Copia la URL HTTPS de ngrok en `NEXT_PUBLIC_APP_URL`, reinicia `pnpm dev` y
prueba la recarga desde `/wallet`.

## Endpoints agregados

- `POST /api/wallet/topup/nowpayments`: crea el invoice sandbox.
- `GET /api/wallet/topup/status/:id`: consulta estado local del intento.
- `POST /api/webhooks/nowpayments`: recibe y procesa IPN.

## Tablas agregadas

- `wallet_accounts`: saldo real USD, saldo demo y puntos por trader.
- `payment_intents`: intenciones de pago y metadata de provider.
- `wallet_movements`: ledger visible en Wallet.
- `webhook_events`: callbacks recibidos para auditoria e idempotencia.

## Limites actuales

- Solo recarga fija de `$20.00 USD`.
- Solo se acredita cuando NOWPayments reporta `payment_status = confirmed` o
  `payment_status = finished`.
- No implementa aun debito automatico de entrada a torneo.
- No implementa retiros ni payouts.
