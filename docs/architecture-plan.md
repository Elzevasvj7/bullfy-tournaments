# Bullfy Tournaments - Plan de Arquitectura

## Estado actual

El proyecto ya tiene una primera base visual y modular para una aplicacion de torneos de trading.

Ultimo modulo de dominio implementado:

- `chat`: chat social con salas globales/de torneo, mensajes del sistema y base de moderacion.

Trabajo posterior realizado:

- `shared/components/app-header.tsx`: header/app shell inicial.
- Ajuste visual de `arena` para acercarse a la captura adjunta.
- Integracion visual de `tournaments`, `arena`, `leaderboard` y `profile`.
- `shared/config/env.ts`: configuracion centralizada para API, realtime y timeouts.
- `shared/services/http-client.ts`: cliente HTTP compartido sobre `fetch`.
- `shared/services/realtime-client.ts`: cliente WebSocket compartido con suscripciones y reconexion.
- Formalizacion base de `wallet` como modulo propio y ruta `/wallet`.
- Formalizacion base de `chat` como modulo propio, ruta `/chat` e integracion con Arena.

## Objetivo del producto

Bullfy Tournaments sera una aplicacion frontend para torneos de trading. El frontend no sera el dueno principal de la logica de torneo; consumira un servicio externo desacoplado que expondra torneos, rankings, arena live, actividad, usuarios y datos relacionados.

La app debe permitir:

- Ver torneos disponibles.
- Entrar a una arena en vivo.
- Consultar ranking de traders.
- Ver perfil y rendimiento del trader.
- Visualizar wallet, puntos, actividad y posicion actual.
- Prepararse para datos live por WebSocket, SSE o polling.

## Principio arquitectonico

La arquitectura propuesta es:

**Feature modules con services locales + infraestructura compartida.**

Cada modulo de dominio contiene sus propios tipos, contratos externos, mapper, cliente y componentes.

Ejemplo:

```txt
modules/
  tournaments/
    components/
    services/
      tournament.client.ts
      tournament.contracts.ts
      tournament.mapper.ts
      tournament.mock.ts
    types.ts
    index.ts
```

Esto evita una carpeta global `services/` gigante sin ownership claro.

## Por que hacerlo asi

El backend de torneos sera externo y puede cambiar de tecnologia, formato o proveedor. Por eso el frontend no debe acoplar sus componentes al shape exacto de la API externa.

Cada modulo tiene:

- `contracts`: forma de datos que viene del servicio externo.
- `mapper`: transforma datos externos al modelo interno del frontend.
- `types`: modelo interno limpio usado por componentes.
- `client`: punto unico de lectura del modulo.
- `mock`: datos temporales para desarrollar UI sin esperar backend real.

Si el servicio externo cambia, normalmente se ajustan `contracts`, `mapper` y `client`, no toda la UI.

## Stack actual

- Next.js `16.2.7`
- React `19.2.4`
- TypeScript
- Tailwind CSS `4`
- App Router de Next.js
- Server Components para carga inicial
- Datos mockeados por modulo

## Patron de carpetas

```txt
app/
  page.tsx
  profile/
    page.tsx
  rankings/
    page.tsx
  chat/
    page.tsx
  wallet/
    page.tsx
  tournaments/
    [slug]/
      page.tsx

modules/
  tournaments/
  arena/
  leaderboard/
  profile/
  wallet/
  chat/

shared/
  components/
    app-header.tsx
```

Patron recomendado a medida que crezca:

```txt
shared/
  components/
  services/
    http-client.ts
    realtime-client.ts
  config/
  lib/
  types/
```

## Infraestructura compartida futura

Base creada:

```txt
shared/services/http-client.ts
shared/services/realtime-client.ts
shared/config/env.ts
```

Responsabilidades:

- Base URL.
- Headers de auth.
- Manejo comun de errores.
- Timeouts.
- Retry controlado.
- Cliente WebSocket/SSE para datos live.

Los modulos seguirian consumiendo esa infraestructura, pero manteniendo su adapter local.

## Modulos planeados

### 1. Tournaments

Estado: implementado base.

Responsabilidad:

- Listado de torneos.
- Detalle basico del torneo.
- Estado: draft, upcoming, live, finished.
- Reglas, premios, participantes, fee y prize pool.

Archivos actuales:

```txt
modules/tournaments/
```

### 2. Arena

Estado: implementado base visual.

Responsabilidad:

- Vista live del torneo.
- Podio.
- Ranking en vivo.
- Metricas clave.
- Actividad reciente.
- Chat visual estatico por ahora.

Nota:

La escena central esta hecha con Tailwind por ahora. La idea futura es reemplazar esa zona por una escena Three.js.

### 3. Leaderboard / Rankings

Estado: implementado base.

Responsabilidad:

- Tabla reutilizable de rankings.
- Ranking global.
- Ranking por torneo.
- Futuro ranking por clan.

La tabla ya se reutiliza desde Arena.

### 4. Profile Dashboard

Estado: implementado base.

Responsabilidad:

- Perfil del trader.
- Wallet.
- Posicion actual.
- Metricas de rendimiento.
- Torneos del usuario.
- Trades recientes.

Este modulo ahora usa el tipo publico de `wallet` para su resumen de saldos.

### 5. Wallet / Economy

Estado: implementado base.

Responsabilidad:

- Balance real.
- Balance demo.
- Bullfy Points.
- Historial de movimientos.
- Pagos de entrada.
- Premios pendientes/reclamados.

Archivos actuales:

```txt
modules/wallet/
```

### 6. Clans

Estado: pendiente.

Responsabilidad:

- Clan del trader.
- Miembros.
- Ranking por clan.
- Estadisticas colectivas.

### 7. Versus

Estado: pendiente.

Responsabilidad:

- Retos 1v1.
- Comparacion entre traders.
- Historial de duelos.
- Resultado del duelo.

### 8. Chat / Social

Estado: implementado base.

Responsabilidad:

- Chat del torneo.
- Mensajes del sistema.
- Actividad social.
- Moderacion futura.

Actualmente existe como modulo propio con datos mockeados y consumo desde Arena.

Archivos actuales:

```txt
modules/chat/
```

Arquitectura funcional base:

- `chat.client.ts`: lectura de salas; usa HTTP si existe `BULLFY_API_BASE_URL` o `NEXT_PUBLIC_BULLFY_API_BASE_URL`, si no cae a mocks.
- `chat.sender.ts`: envio desde navegador; usa `NEXT_PUBLIC_BULLFY_API_BASE_URL` si existe, si no simula envio mock.
- `chat.mapper.ts`: transforma contratos externos a modelo interno y arma el request de envio.
- `ChatPanel`: mantiene estado local y hace actualizacion optimista al enviar mensajes.

### 9. Notifications

Estado: pendiente.

Responsabilidad:

- Alertas de torneo.
- Cambios de posicion.
- Invitaciones.
- Premios.
- Eventos del sistema.

### 10. Admin / Organizer

Estado: pendiente.

Responsabilidad:

- Crear torneo.
- Configurar reglas.
- Revisar participantes.
- Pausar/cancelar torneo.
- Publicar resultados.

## Modelo de integracion con backend externo

El frontend deberia depender de interfaces internas, no directamente del backend.

Ejemplo:

```ts
// API externa
{
  tournament_id: "trn_123",
  start_time: "2026-06-04T17:00:00.000Z"
}

// Modelo interno
{
  id: "trn_123",
  startsAt: "2026-06-04T17:00:00.000Z"
}
```

El mapper protege la UI del contrato externo.

## Datos live

Para la arena en vivo, ranking, chat y actividad, hay tres opciones:

1. WebSocket
2. Server-Sent Events
3. Polling temporal

Recomendacion:

- Usar WebSocket si hay mucha interaccion live y chat.
- Usar SSE si el frontend principalmente recibe eventos.
- Usar polling solo como fase inicial o fallback.

## Three.js

La captura sugiere que la arena central podria convertirse en una escena 3D.

Uso recomendado:

- Mantener `modules/arena` como dueno de la experiencia.
- Crear un componente client-only para la escena:

```txt
modules/arena/components/arena-three-stage.tsx
```

Ese componente puede recibir:

- Podio.
- Participantes top 3.
- Estado live.
- Eventos visuales.

La UI externa de paneles, ranking y chat seguiria siendo React/Tailwind.

## Rutas actuales

```txt
/                      -> Home/listado de torneos
/tournaments/devtest3  -> Arena live
/rankings              -> Ranking global
/profile               -> Dashboard del trader
/wallet                -> Wallet y economy
/chat                  -> Chat global
```

## Siguiente orden recomendado

Por ahora `chat` queda como ultimo modulo trabajado.

Siguientes pasos tecnicos recomendados:

1. Conectar `Profile` con `Wallet` en datos reales cuando exista endpoint compartido.
2. Conectar `Chat` con `shared/services/realtime-client.ts` cuando exista WS/SSE para recibir mensajes entrantes.
3. Reemplazar escena Tailwind de Arena por Three.js.

## Reglas de implementacion

- Un modulo no debe importar detalles internos de otro modulo, salvo exports publicos desde `index.ts`.
- Los componentes no deben consumir DTOs externos directamente.
- Todo dato externo pasa por mapper.
- Los mocks viven dentro del modulo que simulan.
- Lo compartido solo debe ser realmente transversal.
- Evitar crear abstracciones globales antes de necesitarlas.

## Criterio para considerar un modulo listo

Un modulo base esta listo cuando tiene:

- Tipos internos.
- Contratos externos.
- Mapper.
- Cliente.
- Mock.
- Componentes principales.
- Export publico desde `index.ts`.
- Al menos una ruta o consumidor real.
- `pnpm lint` y `pnpm build` pasando.
