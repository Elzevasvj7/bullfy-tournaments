# Auditoria de lovable-source: pagos y avatar

Fecha: 2026-06-17

Nota de ruta: en el repositorio el directorio se llama `lovavle-source`, aunque normalmente se mencione como `lovable-source`.

## Resumen ejecutivo

`lovavle-source` ya trae una base considerable para pagos y avatar, pero no todo esta al mismo nivel de produccion.

Pagos esta dividido en dos dominios:

- Portal IB / ecommerce: productos, academia, eventos y trading room. Es el flujo mas completo.
- Torneos: wallet USD/BMoney y recargas. Esta mas acotado y la UI actual solo expone USDT/Coinsbuy para depositos, aunque el backend tambien soporta Stripe.

Avatar tambien esta dividido en capas:

- Avatar 2D con DiceBear.
- Avatar 3D realista con Avaturn SDK.
- Render 3D con Three.js / React Three Fiber.
- Sistema de poses comprables con Bullfy Points.

El foco prioritario para migrar al proyecto principal deberia ser:

1. Portar el esquema de `tournament_users`, `tournament_wallets`, `tournament_payments`, `tournament_user_poses` y el bucket `tournament-avatars-3d`.
2. Portar las funciones `tournament-profile-update`, `avaturn-session`, `tournament-auth-me`, `tournament-pose-action`, `tournament-pay-create` y `tournament-pay-webhook`.
3. Corregir antes de produccion las inconsistencias de NOWPayments y endurecer autenticacion en `avaturn-session`.

## Pagos: que esta montado

### Configuracion de pasarelas

Hay UI admin en `src/pages/Settings.tsx` que monta:

- `PaymentGatewaySettings`
- `NowPaymentsSettings`
- `SandboxGateways`

`PaymentGatewaySettings` gestiona:

- Coinsbuy.
- Stripe como `stripe_gateway`.
- NOWPayments como `nowpayments`.
- Router cripto `crypto_router` para decidir si el boton "crypto" usa Coinsbuy o NOWPayments.

Archivo clave:

- `lovavle-source/src/components/settings/PaymentGatewaySettings.tsx`
- `lovavle-source/supabase/functions/payment-gateway-config/index.ts`

La funcion `payment-gateway-config` exige usuario admin/global_admin y guarda credenciales en `integration_settings`.

### Portal ecommerce / academia / eventos / trading room

La funcion principal es:

- `lovavle-source/supabase/functions/portal-commerce/index.ts`

Tiene acciones para:

- `checkout`: carrito de productos.
- `checkout_trading_plan`: planes de trading room.
- `checkout_event`: eventos pagados.
- `verify_payment`: polling activo desde el frontend.

Lo positivo:

- Las ordenes se crean como `pending`.
- Stripe crea Checkout Session hospedada y no marca `paid` al iniciar.
- Coinsbuy crea deposito y espera callback/polling.
- NOWPayments crea invoice hospedado y espera callback/polling.
- `ALLOW_SIMULATED_PAYMENTS` esta apagado por defecto y solo simula si se habilita explicitamente.
- Hay registro en `portal_payment_transactions`.
- Al confirmar pago se otorga acceso a cursos, membresias, bundles, eventos y trading room.

Referencias locales:

- `portal-commerce/index.ts:645-657` crea `portal_orders` en `pending`.
- `portal-commerce/index.ts:710-730` inicia Stripe sin marcar pagado.
- `portal-commerce/index.ts:731-760` resuelve cripto real o falla si no hay pasarela.
- `portal-commerce/index.ts:852-972` maneja checkout de trading room.
- `portal-commerce/index.ts:1110-1393` verifica pagos por Stripe, NOWPayments y Coinsbuy.

### Stripe

Esta montado con:

- Configuracion admin de publishable key, secret key y webhook secret.
- Checkout Session hospedada.
- Webhook `stripe-webhook`.
- Verificacion de firma `Stripe-Signature`.
- Verificacion server-to-server contra Stripe antes de finalizar orden.
- Validacion de monto.
- Idempotencia al actualizar solo si `payment_status = pending`.

Referencias:

- `lovavle-source/supabase/functions/stripe-webhook/index.ts`
- `stripe-webhook/index.ts:270-302` exige config y valida eventos relevantes.
- `stripe-webhook/index.ts:288-293` rechaza firma invalida.
- `stripe-webhook/index.ts:366-409` consulta Stripe, valida estado/monto y finaliza.
- `stripe-webhook/index.ts:121-250` finaliza orden, comisiones, ledger, accesos y trading room.

Estado: montado de forma razonable para ecommerce/portal. Falta validar credenciales y endpoint real en entorno destino.

### Coinsbuy

Esta montado para:

- Depositos cripto en portal ecommerce.
- Callback `coinsbuy-callback`.
- Proxy `coinsbuy-proxy` para pruebas y llamadas API.
- Verificacion server-to-server del deposito.
- Validacion de tracking id, estado pagado y monto.

Referencias:

- `lovavle-source/supabase/functions/coinsbuy-callback/index.ts`
- `lovavle-source/supabase/functions/coinsbuy-proxy/index.ts`
- `portal-commerce/index.ts:293-420` crea depositos Coinsbuy.
- `portal-commerce/index.ts:1221-1387` polling/verificacion Coinsbuy.

Estado: montado y usado tambien por torneos.

### NOWPayments

Hay dos integraciones distintas:

1. Flujo ecommerce real:
   - Usa `service_name = "nowpayments"`.
   - Crea invoice en `portal-commerce`.
   - Callback real: `nowpayments-callback`.
   - Valida API key, payment id, order id, estado y monto.

2. Flujo/configuracion separada:
   - Usa `service_name = "nowpayments_gateway"`.
   - UI: `NowPaymentsSettings`.
   - Webhook: `nowpayments-webhook`.
   - Tabla: `nowpayments_payments`.
   - Parece orientado a pagos/trading room por `order_id = tr_sub:<subscription_id>`.

Riesgo principal:

- `PaymentGatewaySettings` guarda NOWPayments como `nowpayments`.
- `NowPaymentsSettings` y `nowpayments-webhook` leen `nowpayments_gateway`.
- Esto puede confundir al admin: una pantalla puede decir "configurado" mientras el flujo que se use lee otra fila.

Referencias:

- `PaymentGatewaySettings.tsx:66-90` lee `nowpayments`.
- `payment-gateway-config/index.ts:76-91` guarda `nowpayments`.
- `NowPaymentsSettings.tsx:45-91` usa `nowpayments-config`.
- `nowpayments-config/index.ts` usa `nowpayments_gateway`.
- `nowpayments-callback/index.ts:19-27` lee `nowpayments`.
- `nowpayments-webhook/index.ts:61-70` lee `nowpayments_gateway`.

Estado: funcional pero duplicado/inconsistente. Conviene unificar antes de migrar.

### Wallet y comisiones del portal IB

Hay documentacion y migraciones avanzadas para comisiones, wallet segregado por metodo y retiros:

- `lovavle-source/docs/comisiones-modelo.md`
- `portal_wallet_balances` con buckets `usdt` y `stripe`.
- `portal_commission_lines`.
- Funciones de credito y release.
- Retiros por metodo.

Estado: hay bastante modelo contable, pero no queda claro que todo este completamente conectado a produccion para Stripe settlement final; el propio documento lista el listener de liquidacion Stripe como fase pendiente.

## Pagos: que no esta montado o esta parcial

### Torneos: pagos directos de entry fee deshabilitados

La funcion de pago de torneos solo permite `wallet_topup`.

Referencias:

- `tournament-pay-create/index.ts:57-64` rechaza tipos distintos a `wallet_topup`.
- `tournament-pay-webhook/index.ts:56-69` solo acredita wallet si el pago es `wallet_topup`.

Estado: no hay pago directo robusto para entrada a torneo; el flujo esperado es recargar wallet y luego inscribirse debitando wallet.

### Torneos: Stripe backend existe, UI no lo ofrece

`tournament-pay-create` acepta `gateway: "stripe" | "coinsbuy"`, pero `TournamentWallet` actualmente llama con `gateway: "coinsbuy"` y el texto es "Depositar con USDT".

Referencias:

- `tournament-pay-create/index.ts:57-83` acepta Stripe/Coinsbuy.
- `TournamentWallet.tsx:175-181` comenta que se podria restaurar tarjeta, pero envia Coinsbuy.
- `TournamentWallet.tsx:263` muestra "Depositar con USDT".

Estado: backend parcial para Stripe en torneos; UI de usuario no lo monta.

### Torneos: NOWPayments no esta integrado

No aparece NOWPayments en `tournament-pay-create` ni `tournament-pay-webhook`; solo Stripe y Coinsbuy.

Estado: si se quiere NOWPayments para torneos, falta implementarlo.

### Webhooks/secretos a provisionar

Para que funcione fuera de Lovable/Supabase actual hacen falta:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Credenciales Stripe en `integration_settings`.
- Webhook Stripe registrado en Stripe apuntando a `/functions/v1/stripe-webhook`.
- Credenciales Coinsbuy y wallet.
- Credenciales NOWPayments, eligiendo una sola convencion de `service_name`.
- Para torneo Stripe webhook: `STRIPE_WEBHOOK_SECRET` en `tournament-pay-webhook` si se activa ese camino.

## Avatar: que esta montado

### Rutas y UI

En `App.tsx` existe `/tournament/avatar`, `/tournament/poses` y `/tournament/p/:username`.

Referencias:

- `lovavle-source/src/App.tsx:208-210`

El dashboard enlaza a personalizar avatar:

- `lovavle-source/src/pages/tournament/TournamentDashboard.tsx`

### Avatar 2D

Hay avatar 2D con DiceBear:

- `@dicebear/core`
- `@dicebear/collection`
- Estilos: `avataaars`, `adventurer`, `bottts`, `funEmoji`, `lorelei`, `micah`, `notionists`, `pixelArt`.

Referencias:

- `TournamentAvatar.tsx:15-24`
- `TournamentAvatar.tsx:65-79`

Estado: montado.

### Avatar 3D con Avaturn

La pantalla `TournamentAvatarStudio` monta Avaturn SDK:

- Pide una sesion a `avaturn-session`.
- Usa `new AvaturnSDK().init(container, { url })`.
- Escucha evento `export`.
- Extrae URL/GLB del payload.
- Guarda `avaturn_user_id`, `avaturn_avatar_id`, `gender` y `avatar_3d_url`.

Referencias:

- `TournamentAvatarStudio.tsx:119-194`
- `TournamentAvatarStudio.tsx:232-252`
- `avaturn-session/index.ts:23-89`

Estado: montado, condicionado por `AVATURN_API_KEY`.

### Persistencia de avatar 3D

El avatar se guarda en `tournament_users`:

- `avatar_config`
- `avatar_3d_url`
- `avatar_url`

`tournament-profile-update` valida el token de torneo, acepta URLs http(s) o data URLs GLB, y si recibe un GLB base64 lo sube a Storage bucket `tournament-avatars-3d`.

Referencias:

- `tournament-profile-update/index.ts:4` bucket `tournament-avatars-3d`.
- `tournament-profile-update/index.ts:27-40` sube data URL GLB a Storage.
- `tournament-profile-update/index.ts:74-103` valida config y URL.
- `tournament-profile-update/index.ts:112-118` actualiza `tournament_users`.

Estado: montado, pero hay que asegurar que el bucket exista en la DB destino. En las busquedas no aparecio una migracion SQL clara creando `tournament-avatars-3d`; la funcion lo asume.

### Render 3D

Hay render con Three.js:

- `@react-three/fiber`
- `@react-three/drei`
- `three`
- `useGLTF`
- `SkeletonUtils.clone`
- `AnimationMixer`
- fallback a avatar 2D si falla.

Referencias:

- `TournamentAvatar3D.tsx:1-7`
- `TournamentAvatar3D.tsx:21-31`
- `TournamentAvatar3D.tsx:224-246`

Estado: montado y con cuidado especifico para no agotar contextos WebGL.

### Uso del avatar en producto

El avatar 3D/2D se usa en:

- Perfil publico: `TournamentProfile.tsx`.
- En vivo: `TournamentLive.tsx`.
- Podio: `TournamentPodium.tsx`.
- TV: `TournamentTV.tsx`.
- Arena: `TournamentArena.tsx`.
- Overlay del layout: `TournamentAvatarOverlay.tsx`.
- Poses: `TournamentPoses.tsx`.

Estado: bastante integrado en la experiencia de torneo.

### Poses y bailes

Hay tienda de poses:

- Catalogo en `avatarAnimations.ts`.
- Free poses.
- Poses pagas con BP.
- Funcion `tournament-pose-action`.
- Tabla `tournament_user_poses`.
- Campo `preferred_pose` en `tournament_users`.

Referencias:

- `TournamentPoses.tsx:55-64` exige avatar 3D primero.
- `TournamentPoses.tsx:67-87` llama `tournament-pose-action`.
- `tournament-pose-action/index.ts`
- `useTournamentAuth.tsx:34-36` carga poses desbloqueadas.

Estado: montado.

## Avatar: que no esta montado o esta parcial

### `avaturn-session` no autentica al usuario de torneo

La propia funcion dice que no valida el token y que solo proxya una URL corta.

Referencias:

- `avaturn-session/index.ts:5-7`

Riesgo:

- Cualquier cliente podria consumir sesiones Avaturn si tiene acceso al endpoint y la funcion esta desplegada publicamente.
- Tambien podria pedir editar un `avaturn_avatar_id` si lo conoce.

Recomendacion:

- Exigir `Authorization: Bearer <tournament_session_token>`.
- Resolver `tournament_user` con `requireTournamentUser`.
- Ignorar `avaturn_user_id` del body si no coincide con `avatar_config` del usuario autenticado.

### Ready Player Me quedo como codigo legacy

Hay modal y listener de RPM, pero en el editor actual solo se muestra Bullfy Avatar / Avaturn. No vi un boton que active `setRpmOpen(true)`.

Referencias:

- `TournamentAvatarStudio.tsx:209-228`
- `TournamentAvatarStudio.tsx:396-438`

Estado: no montado en UI actual.

### Editor 2D practicamente removido

El archivo conserva imports, estilos, moods y utilidades de avatar 2D, pero la seccion visible del editor esta centrada en Avaturn. El comentario dice "solo Bullfy Avatar por ahora".

Referencia:

- `TournamentAvatarStudio.tsx:349`

Estado: fallback 2D existe, pero la personalizacion 2D completa no esta expuesta en esta pantalla.

### Borrado remoto de Avaturn no implementado

El admin muestra texto de ban indicando que elimina avatar 3D de Avaturn, pero en lo revisado no aparece una llamada clara a DELETE de Avaturn. La pantalla de usuario "Quitar Bullfy Avatar" solo limpia `avatar3dUrl` local hasta guardar; no borra el recurso remoto.

Estado: faltaria limpieza remota y/o politica de retencion.

## Dependencias clave detectadas

En `lovavle-source/package.json`:

- `@avaturn/sdk`
- `@dicebear/core`
- `@dicebear/collection`
- `@react-three/fiber`
- `@react-three/drei`
- `three`

## Fuentes externas verificadas

Estas fuentes se usaron solo para contrastar que el enfoque local corresponde con la integracion esperada por los proveedores:

- Stripe documenta fulfillment de Checkout por webhook y evento `checkout.session.completed`: https://docs.stripe.com/checkout/fulfillment
- Stripe documenta recepcion de eventos en endpoint webhook: https://docs.stripe.com/webhooks
- NOWPayments documenta IPN con `x-nowpayments-sig` y HMAC SHA-512: https://nowpayments.zendesk.com/hc/en-us/articles/21395546303389-IPN-and-how-to-setup
- Avaturn documenta sesiones cortas y `sdk.init(...)`: https://docs.avaturn.me/docs/integration/web/sdk/introduction/
- Avaturn documenta el flujo `users/new` + `sessions/new`: https://docs.avaturn.me/docs/integration/api/basic_flow/

## Recomendacion de migracion

### Migrar primero

- UI de torneo: `TournamentAvatarStudio`, `TournamentAvatar3D`, `TournamentAvatar`, `TournamentPoses`, `avatarAnimations`.
- Funciones: `avaturn-session`, `tournament-profile-update`, `tournament-auth-me`, `tournament-pose-action`.
- DB: columnas de avatar en `tournament_users`, `tournament_user_poses`, storage bucket `tournament-avatars-3d`.

### Migrar pagos con cautela

- Para portal ecommerce: migrar `portal-commerce`, `stripe-webhook`, `coinsbuy-callback`, `nowpayments-callback`, `payment-gateway-config`, tablas de ordenes/transacciones/wallet.
- Para torneos: migrar `tournament-pay-create`, `tournament-pay-webhook`, `tournament-bmoney-topup`, `tournament-withdraw-request`.

### Corregir antes de produccion

- Unificar NOWPayments (`nowpayments` vs `nowpayments_gateway`).
- Endurecer autenticacion de `avaturn-session`.
- Crear/verificar bucket `tournament-avatars-3d`.
- Decidir si torneo tendra pagos con tarjeta en UI o solo USDT.
- Si se quiere NOWPayments en torneos, implementarlo explicitamente.
- Revisar encoding de textos importados desde `lovavle-source`; hay caracteres mojibake en varios archivos.
