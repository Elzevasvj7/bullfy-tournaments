# Módulo "Tarjetas" en Contabilidad

## Qué entiendo
Necesitas un módulo nuevo dentro de **Contabilidad → Tarjetas** donde un admin pueda dar de alta tarjetas (Débito o Crédito) y asignarlas a un usuario interno. Cada tarjeta guarda solo los **últimos 4 dígitos** (no el PAN completo, por seguridad), banco/emisor, marca y alias. Luego, cuando ese usuario cargue una **Factura** (y al aprobarla pase a **Gasto**), podrá seleccionar la tarjeta usada para pagar — habilitando reportes por tarjeta más adelante.

## Alcance

1. **Base de datos** — nueva tabla `accounting_cards` y columna `card_id` en `accounting_invoices` y `accounting_expenses`.
2. **Módulo Tarjetas** — página `/contabilidad/tarjetas` para CRUD y asignación a usuarios.
3. **Tile** en `ContabilidadHome` (sección "Configuración / Catálogos").
4. **Integración Facturas** — al cargar/aprobar factura, se muestra el selector con las tarjetas **del usuario actual**; el seleccionado se guarda en la factura y se propaga al gasto al aprobar.
5. **Editar pago existente** — el diálogo `EditInvoicePaymentDialog` también incluye el selector de tarjeta.

## Estructura de datos

```text
accounting_cards
 ├── id (uuid)
 ├── user_id (uuid → profiles)        -- dueño de la tarjeta
 ├── card_type ('debit' | 'credit')
 ├── brand ('visa'|'mastercard'|'amex'|'other')
 ├── bank (text)                       -- ej: "Bancolombia"
 ├── alias (text)                      -- ej: "Visa Personal"
 ├── last4 (varchar(4))                -- solo 4 dígitos
 ├── currency (text, default 'USD')
 ├── credit_limit (numeric, nullable)  -- solo crédito
 ├── is_active (bool, default true)
 ├── notes (text, nullable)
 ├── created_at, updated_at
```

- RLS: SELECT permitido al dueño + roles contables/admin; INSERT/UPDATE/DELETE solo a roles contables/admin.
- `accounting_invoices.card_id` y `accounting_expenses.card_id` (FK opcional → `accounting_cards`).
- Extender RPC `approve_invoice_to_expense` para pasar `p_card_id` y persistirlo en `accounting_expenses` + audit log.

## UI

**`/contabilidad/tarjetas`** (`TarjetasPage.tsx`)
- Tabla: Usuario · Alias · Tipo · Marca · Banco · ****Last4 · Moneda · Activa · acciones.
- Filtros por usuario y por tipo.
- Botón "Nueva tarjeta" → diálogo con: usuario (Select de `profiles`), tipo, marca, banco, alias, últimos 4 (input limitado a 4 dígitos numéricos), moneda, límite (si crédito), activa.
- Edición y borrado lógico (`is_active=false`).

**Tile** en `ContabilidadHome` (Configuración), ícono `CreditCard`.

**Selector de tarjeta** (componente `CardSelect`)
- Lista solo tarjetas activas del usuario actual.
- Opción "— Sin tarjeta —".
- Muestra: `Alias · ****1234 (Visa Débito)`.

**Integraciones**
- `NewInvoiceDialog` (o el formulario de carga de factura) — añadir `CardSelect` debajo del medio de pago.
- `ApproveInvoiceDialog` — añadir `CardSelect` (precargado con la tarjeta de la factura si ya tiene una).
- `EditInvoicePaymentDialog` — añadir `CardSelect`.
- `FacturasPage.tsx` — incluir `card_id` en payload de `approve_invoice_to_expense`.

## Seguridad
- **NUNCA** guardar el PAN completo, CVV ni fecha de expiración. Solo últimos 4, marca y alias.
- Validación zod en cliente: `last4` exactamente 4 dígitos.
- Constraint DB: `last4 ~ '^[0-9]{4}$'`.

## Fuera de alcance (para una segunda fase si lo pides)
- Reportes por tarjeta (gasto mensual, conciliación con estado de cuenta).
- Importación de movimientos de tarjeta desde extracto bancario.
- Tope/alertas de límite de crédito.

Confírmame y lo implemento.
