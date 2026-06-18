---
name: Bullfy eCommerce System
description: Digital products marketplace per Partner Portal with cart, checkout, per-portal accounting, revenue splits, and commission engine
type: feature
---

## Architecture

- **portal_commerce_access** — Toggle per IB (enabled from IBMaintenance like other access modules)
- **portal_products** — Digital product catalog per portal (digital or course type; courses link via reference_id to academy_courses)
- **portal_cart_items** — Temporary cart per partner_user (managed via portal-commerce edge function since partner_users aren't auth.users)
- **portal_orders** / **portal_order_items** — Orders with auto-generated order numbers (ORD-XXXXXX)
- **portal_ledger** — Per-portal accounting ledger with running balance
- **portal_revenue_splits** — Configurable revenue distribution rules per portal (default: platform 10%, portal_owner 80%, referrer 10%)
- **portal_commissions** — Commissions generated per sale based on splits

## Flows

1. Admin enables eCommerce for an IB via toggle in Mantenimiento IBs
2. Default revenue splits are auto-created (trigger: create_default_revenue_splits)
3. Admin manages products, views orders/ledger/commissions in "Tienda" section
4. Client browses catalog, adds to cart, checks out via Stripe or Coinsbuy
5. On checkout: order created → payment processed → cart cleared → commissions calculated → ledger updated → auto-enrollment for courses

## Edge Function

`portal-commerce` handles: add_to_cart, remove_from_cart, checkout (uses service_role since partner_users aren't auth.users)

## Modularity for MLM

- beneficiary_type in portal_commissions is extensible (text, not enum): portal_owner, platform, referrer, mlm_upline
- role_label in portal_revenue_splits is also text-based for future MLM tiers
- Ledger supports any entry_type for future payout/withdrawal flows
