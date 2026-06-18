---
name: Partner Portal MLM System (Multi-Mode + Business Partners)
description: MLM modular por portal con 2 modos de comisión (pool / multi-producto), Socios del Portal con % independiente, eWallet, retiros duales (Coinsbuy + Stripe)
type: feature
---

## Modos de comisión

`portal_mlm_config.commission_mode`:
- **`pool`** (legacy): % global de la venta → repartido entre niveles del upline (`portal_mlm_levels`).
- **`multi_product`**: cada producto tiene su propia tabla `portal_product_commission_levels` (level_number + %, suma ≤100% por producto). Comisión = `unit_price × quantity × %nivel` por línea de orden, una fila de comisión por (línea × nivel) para trazabilidad.

## Socios del Portal (additive)

`portal_mlm_config.business_partners_enabled` + tabla `portal_business_partners`:
- Usuarios del propio portal con un `%` independiente sobre `total_usd` de cada venta (adicional al MLM).
- Solo pueden ser socios usuarios `partner_users` con `can_be_business_partner = true` (flag exclusivo del Master Admin / global_admin desde **AdminUsuarios → Socios de Portales** → `PartnerUsersGlobalAdmin.tsx`).
- Trigger `validate_business_partner` valida: pertenencia al portal, elegibilidad y suma de % activos ≤ 100.
- `beneficiary_type = 'business_partner'`, transacción `business_partner_commission_pending` en wallet.

## Edge function `mlm-engine` (3 ramas)

1. Pool: idéntico a la lógica original.
2. Multi-product: itera `portal_order_items` y por cada producto lee `portal_product_commission_levels`.
3. Business partners: si `business_partners_enabled`, suma comisión independiente por cada socio activo.

Todas las comisiones pasan por wallet `pending → available` (cron `mlm-release-commissions-hourly`).

## Permisos cross-portal

- Helpers: `public.is_global_admin()`, `public.is_portal_owner(_portal_id)`.
- Tablas nuevas (`portal_product_commission_levels`, `portal_business_partners`): RLS permite CRUD a portal owner y a global_admin; SELECT público en commission_levels (clientes ven info).
- `partner_users` ya permite UPDATE a global_admin (política existente).

## UI

- **`MLMConfigAdmin.tsx`**: tabs "Modo y Niveles" / "Socios" / "Info". Selector Pool|Multi-Producto. Gestión inline de socios con elegibles disponibles del portal.
- **`PortalStoreAdmin.tsx`**: lee `commission_mode` y muestra botón Layers en cada producto (solo si `multi_product`) que abre `ProductCommissionLevelsDialog.tsx`.
- **`AdminUsuarios.tsx`** (global_admin): nuevo tab "Socios de Portales" → `PartnerUsersGlobalAdmin.tsx` para togglear `can_be_business_partner` cross-portal.

## Estado por fases

- ✅ Fases 1-6 originales (config, edge engines, retiros duales Coinsbuy+Stripe, captura de ref).
- ✅ Fase A: Modo `multi_product` + tabla `portal_product_commission_levels` + UI editor por producto.
- ✅ Fase B: `portal_business_partners` + `can_be_business_partner` + elegibilidad por global_admin + integración en mlm-engine.
- ✅ Fase C: helpers `is_global_admin` / `is_portal_owner`, RLS de las nuevas tablas con acceso cross-portal para global_admin.
