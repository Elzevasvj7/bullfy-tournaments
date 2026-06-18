# Modelo de comisiones, wallet y retiros — Bullfy IB (fuente de verdad)

> Documento de diseño aprobado. Define el modelo ÚNICO de reparto de cada venta, el
> wallet segregado por método, y los retiros. Reemplaza el esquema previo de
> "revenue split (platform/owner/referrer)" + "dos modos MLM (pool / multi-producto)".

## 1. Reparto de cada venta bruta `G`

Todos los cortes son porciones del **mismo 100%** y suman 100% exacto:

```
G (100%)
 1. Bullfy Platform Fee = G × feePct        → Bullfy   (lo fija GLOBAL ADMIN por portal; default 0%; editable)
 2. net = G − fee                            = pot del negocio del IB
 3. Red (pool): se recorre la UPLINE COMPRIMIDA del comprador (solo ancestros ACTIVOS).
    Por cada nivel L con %_L (porcentaje DE LA VENTA G): paga al ancestro en esa
    posición comprimida. Tope: Σ niveles ≤ poolPct.
    networkPaid = lo realmente pagado a la red (= 0 si el comprador es directo del IB
    o no hay ancestros activos).
 4. Socios (incluye al IB como un socio más):
        pot_socios = net − networkPaid
        se reparte entre socios por su participación (peso relativo).
 ⇒ fee + networkPaid + socios = G   (siempre 100%)
```

### Reglas clave
- **Compresión:** si un ancestro de la cadena está inactivo (abandono/expulsión/inactividad),
  el siguiente ancestro activo sube a ocupar su lugar. La cadena no se rompe; los niveles
  se cuentan sobre ancestros activos.
- **Pool no reclamado → socios:** lo que la red no alcanza a reclamar (comprador directo
  del IB, o cadena más corta que la profundidad configurada) **engrosa el pot de socios**
  y se reparte entre ellos (el IB, como socio, recibe su parte). Nunca queda colgado ni
  lo absorbe el IB de forma arbitraria.
- **Niveles = % de la venta** (no % del pool). Validación: `Σ niveles ≤ poolPct`.
- **Config del portal:** `feePct + poolPct + Σ socios = 100%`. El IB es un socio.

## 2. Comisiones de pasarela (Stripe / NOWPayments)
- **Al comprar:** las paga el **comprador** (se suman al monto cobrado). El reparto del 100%
  se hace sobre el **precio limpio**.
- **Al retirar:** las paga **quien retira** (neto = monto − fee del payout).

## 3. Disponibilidad de fondos
- **USDT / cripto:** irreversible → **Disponible al instante** al confirmarse el pago.
- **Stripe / fiat:** entra como **Pendiente** y pasa a **Disponible** cuando **Stripe valida
  la liquidación** (event-driven, no temporizador fijo). La UI muestra "Pendiente (fiat)"
  con disclaimer: *"Sujeto a confirmación; puede variar por contracargos de Stripe."*

## 4. Wallet por beneficiario (IB, socios, usuarios de red)
Campos coherentes y mínimos indispensables:
- **Disponible USDT** (cripto)
- **Disponible Stripe** (fiat)
- **Pendiente Stripe** (fiat en ventana de validación; con disclaimer)
- **Total ganado**
- **Link de invitación** (garantiza ubicar al invitado debajo del invitador, IB o no-IB)
- **Config wallet USDT TRC20** (destino cripto)
- **Datos Stripe Connect** (destino fiat)
- **Retiros por método** (cada uno limitado al disponible de ese método)
- **Historial de retiros**

## 5. Red e invitación
- Árbol en `portal_mlm_referrals` (raíz = IB), con compresión al pagar.
- **Solo usuarios con MLM activo (lo activa el GLOBAL ADMIN) tienen link de referido**, para
  que nadie arme red por fuera.

## 6. Distribución por producto (reemplaza el "modo Multi-Producto")
- En el formulario de creación de cada producto (curso / evento / membresía / bundle):
  un **toggle de distribución personalizada**, OFF por default.
  - OFF → usa la distribución general por niveles del portal.
  - ON → el IB define una distribución por nivel propia para ESE producto, repartiendo
    dentro del **pool%** (no del 100%).

## 7. Eliminado
- Selector de "Modo de Comisión".
- Modo "Multinivel Multi-Producto" como tal.
- "Refund Window" (sustituido por la validación de liquidación de Stripe para fiat; cripto
  es inmediato).

## 8. Tienda
- Panel de seguimiento de ventas: quién compró, qué, cuándo, método, estado — sin
  redundancias con la creación de productos (que vive en Academy/Eventos).

## 9. Fases de implementación
1. **Esquema + motor** (mlm-engine al nuevo algoritmo; platform fee; wallet segregado por
   método; acreditación inmediata cripto / pendiente fiat).
2. **Config** (Bullfy Platform Fee en panel global admin por portal; simplificar MLMConfigAdmin
   a un solo modelo; socios con IB; validación = 100%).
3. **Per-producto** (toggle de distribución en los 4 formularios de creación).
4. **Wallet/contabilidad nueva** (rediseño con campos coherentes; retiros por método).
5. **Listener de liquidación Stripe** (Pendiente→Disponible fiat) + UI de pendientes.
6. **Tienda** (panel de ventas/seguimiento).
