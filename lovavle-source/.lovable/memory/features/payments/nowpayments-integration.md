---
name: NowPayments Integration
description: Crypto payment gateway with sandbox/live switcher, HMAC-SHA512 IPN webhook validation
type: feature
---

## Architecture
- Service stored in `integration_settings` with `service_name='nowpayments_gateway'`.
- Config JSONB holds: `environment` ('sandbox'|'live'), `api_key_live`, `ipn_secret_live`, `api_key_sandbox`, `ipn_secret_sandbox`.
- Edge function `nowpayments-config` (admin only) handles save/get/test_connection.
- Edge function `nowpayments-webhook` (verify_jwt=false) validates IPN signature.
- UI in Settings → Pasarelas de Pago: `NowPaymentsSettings.tsx`.

## API Endpoints
- Live base: `https://api.nowpayments.io/v1`
- Sandbox base: `https://api-sandbox.nowpayments.io/v1`
- Auth header: `x-api-key: <API_KEY>`
- Test endpoint: `GET /currencies` (validates API key)

## IPN Signature Validation
1. Read raw body + `x-nowpayments-sig` header.
2. Recursively sort JSON object keys alphabetically.
3. JSON.stringify the sorted object.
4. HMAC-SHA512 with the IPN Secret of the active environment.
5. Compare hex digest case-insensitive against header.

## Database
Table `nowpayments_payments`: invoice_id, payment_id (UNIQUE), order_id, status, price/pay amounts and currencies, pay_address, actually_paid, environment, raw_payload. Admin-only RLS via `has_role`.

## Webhook URL
`https://<PROJECT_ID>.supabase.co/functions/v1/nowpayments-webhook` — paste in NowPayments Store Settings → IPN callback URL. Same URL works for both sandbox and live; the function routes by the configured `environment`.

## Status: Connected only
No checkout UI yet. To add checkout: create `nowpayments-create-invoice` function calling `POST /invoice` with order_id, price_amount, price_currency, ipn_callback_url, success_url, cancel_url; store the row, return `invoice_url` to client.
