---
name: Trading Room Subscriptions Flow
description: NowPayments-driven 30-day subscription cycle for Trading Room plans, multi-plan per user, day-25 renewal, day-30 expiration
type: feature
---

## Subscription Lifecycle

- **Multi-plan**: a partner_user can hold multiple active subscriptions (one per plan_id). Partial unique index `trading_room_subs_active_unique` enforces 1 active row per (user, plan).
- **Activation**: triggered by `nowpayments-webhook` when `order_id` matches `tr_sub:<sub_id>` and status is `finished`/`confirmed`/`sending`. Sets period_start = now (or chained to current_period_end if renewal), period_end = +30d, renewal_due_at = +25d.
- **Renewal chaining**: if user pays again before period_end, order_id includes `:renewal` suffix and new period starts when current one ends (no days lost).
- **Expiration**: cron `trading-room-expire-subs-daily` runs daily 03:00 UTC → marks `access_status='expired'`. UI hides MT5/streaming sections and `can_trade=false` blocks all trading actions in `trading-room-client`.

## Edge Functions
- `trading-room-create-invoice`: creates NowPayments invoice, returns `invoice_url`. Inserts/updates subscription as `pending_payment`.
- `trading-room-expire-subscriptions`: cron job, marks expired subs.
- `nowpayments-webhook`: handles `tr_sub:` order_ids to activate subscriptions.

## UI
- `PlanSelectorMenu.tsx`: dropdown "Selecciona tu Plan" + status badge + checkout button. Polls every 15s for webhook updates.
- Status pills: Sin contratar / Esperando pago / Activo (Xd) / Renovar (Xd, ≤5 días) / Expirado.

## DB Schema additions
- `renewal_due_at`, `next_period_start`, `last_payment_id`, `pending_invoice_id`, `pending_invoice_url`, `expired_at` on `trading_room_subscriptions`.
- Status options expanded: `expired`, `pending_payment`.
