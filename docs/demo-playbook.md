# Bullfy Tournament Demo Playbook

Esta guia describe que puedes mostrar con la demo actual, como levantarla y cuales son los limites esperados. La idea es que puedas ensenar un flujo completo de torneo de trading sin depender todavia del backend final de Supabase.

## Que Se Puede Mostrar

- Login demo con usuarios tipo MT5.
- Lobby publico con el torneo demo.
- Entrada al cockpit del torneo.
- Union de un usuario al torneo.
- Creacion/conexion de cuenta MT5 demo desde el cockpit.
- Envio de orden demo BUY/SELL desde el ticket MT5.
- Registro de orden y posicion abierta en Postgres local.
- Actualizacion de balance, PnL, trades, win rate y ranking.
- PnL MT5 en el cockpit sincronizado cada pocos segundos contra posiciones abiertas.
- Actividad reciente de la arena.
- Cierre de posiciones abiertas desde el cockpit.
- ArenaTV como vista publica/live sin controles de trading.
- Fallback mock del bridge MT5 si el bridge real no esta configurado o falla.

## Comandos

Levantar Postgres local, migrar y sembrar datos:

```bash
pnpm db:demo
```

Levantar la app:

```bash
pnpm dev
```

Abrir:

```txt
http://localhost:3000
```

Si cambias `.env`, reinicia `pnpm dev` para que Next.js tome las nuevas variables.

La demo usa `proxy.ts` para proteger rutas privadas. Si no hay una cookie `bullfy_demo_session` valida, estas rutas redirigen a `/login?next=...`:

```txt
/chat
/clans/create
/profile
/profile/history
/tournaments/create
/tournaments/{slug}
/wallet
```

La vista publica `/tournaments/{slug}/tv` permanece abierta para ArenaTV.

Los datos del usuario activo salen de una capa server-side en:

```txt
modules/auth/services/session-user.ts
```

Esa capa lee el JWT de sesion, consulta `demo_traders` y agrega metricas desde Postgres local. El perfil, chat, header, cockpit/ArenaTV y la modal de inscripcion consumen ese usuario sin leer la cookie directamente desde componentes cliente.

Verificar build antes de presentar:

```bash
pnpm lint
pnpm build
```

## Conexion DB En DBeaver

```txt
Driver: PostgreSQL
Host: localhost
Port: 54329
Database: bullfy_tournaments
Username: bullfy
Password: bullfy_dev
JDBC URL: jdbc:postgresql://localhost:54329/bullfy_tournaments
```

La misma conexion en formato URL:

```txt
postgres://bullfy:bullfy_dev@localhost:54329/bullfy_tournaments
```

## Usuarios Demo

Estas credenciales son para entrar a la app Bullfy. No son las credenciales MT5.

```txt
Participante 1
usuario Bullfy: valentina
pass Bullfy: DemoTrader1!
cuenta MT5 vinculada: 121827

Participante 2
usuario Bullfy: mateo
pass Bullfy: DemoTrader2!
cuenta MT5 vinculada: 121828

Usuario base
usuario Bullfy: nando
pass Bullfy: TestPass123!
cuenta MT5 vinculada: 121734
```

Las credenciales MT5 originales quedan guardadas en la DB local como datos de vinculacion de cuenta:

```txt
MT5 participante 1
login: 121827
password: TestPass123!

MT5 participante 2
login: 121828
password: TestPass123!
```

## Flujo Recomendado Para Presentar

1. Entrar a `/login`.
2. Iniciar sesion con `valentina` o `mateo`.
3. Volver al lobby `/`.
4. En la card de `Bullfy Tournament Open`, presionar `Entrar al cockpit`.
5. En el panel izquierdo, presionar `Unirme al torneo` si el usuario aun no esta inscrito.
6. En el ticket MT5, presionar `Conectar cuenta MT5 demo`.
7. Abrir una operacion con:
   - simbolo: `EURUSD`, `GBPUSD` o `XAUUSD`
   - lado: `BUY` o `SELL`
   - lotes: `0.1`
8. Verificar que aparezca en `Operaciones abiertas`.
9. Verificar que el panel `Sync MT5` quede `Actualizado` y que el PnL venga de `/users/{login}/positions`.
10. Verificar que la actividad reciente registre la operacion.
11. Verificar que la tabla de ranking cambie el PnL/rank.
12. Cerrar la posicion desde `Operaciones abiertas`.
13. Cambiar a `ArenaTV` para mostrar la vista de transmision.

## Rutas Utiles

```txt
/login
/
/tournaments/bullfy-tournament-open
/tournaments/bullfy-tournament-open/tv
/profile
/profile/history
/wallet
```

## APIs Demo

Estas rutas son internas de la demo y usan el usuario actual desde la cookie firmada `bullfy_demo_session`.

```txt
GET  /api/demo/tournaments/bullfy-tournament-open/arena
POST /api/demo/tournaments/bullfy-tournament-open/join
POST /api/demo/tournaments/bullfy-tournament-open/mt5-account
POST /api/demo/tournaments/bullfy-tournament-open/orders
GET  /api/demo/tournaments/bullfy-tournament-open/positions
POST /api/demo/tournaments/bullfy-tournament-open/positions/{positionId}/close
```

La sincronizacion de posiciones abiertas usa este flujo:

```txt
1. El cockpit consulta GET /api/demo/tournaments/{slug}/positions cada 3 segundos.
2. La API local consulta GET /users/{login}/positions en el bridge MT5.
3. Si encuentra la posicion, actualiza bridge_position_id, precio actual y PnL local.
4. Si una posicion local ya no existe en MT5, la marca cerrada para evitar cierres duplicados.
5. Al cerrar, la app usa primero demo_trade_positions.bridge_position_id.
6. Cierra con POST /users/{login}/positions/{position_id}/close.
7. Si el bridge cierra bien, marca la posicion local como `closed`.
```

Body minimo para abrir una orden:

```json
{
  "symbol": "EURUSD",
  "side": "buy",
  "volume": 0.1
}
```

## Que Es Real En Esta Demo

- La DB local corre en Postgres con Docker.
- Las migraciones y seeds estan versionadas en `db/migrations` y `db/seeds`.
- El login demo guarda una cookie httpOnly con un JWT firmado usando `SESSION_SECRET`.
- La inscripcion al torneo crea un participante real en la DB local.
- Las ordenes, posiciones, eventos, balance y ranking se guardan en la DB local.
- El cockpit consume rutas API reales de Next.js.
- El cockpit sincroniza posiciones abiertas desde `/users/{login}/positions` a traves de una API local de Next.js.

## Que Es Mock O Temporal

- Las contrasenas demo estan en texto plano porque no es el auth final.
- Si no hay bridge MT5 configurado, se usa el adapter mock.
- Si el bridge MT5 esta configurado y rechaza una orden, la demo muestra el error y no crea orden/posicion local.
- El PnL abierto depende del valor `profit` que retorne el bridge en `/users/{login}/positions`.
- El ranking se calcula con `score_pct`, `pnl`, trades y fecha de inscripcion.
- El chat sigue siendo UI/mock.
- ArenaTV muestra la misma fuente de datos demo, no streaming real.
- Supabase queda como fallback de auth, pero el flujo de demo usa Postgres local.
- Las cuentas MT5 `121827` y `121828` no son usuarios de login de Bullfy; son datos de vinculacion para conectar el ticket MT5.

## Archivos Clave

```txt
db/migrations/001_demo_tournament.sql
db/migrations/002_demo_auth_and_join.sql
db/seeds/001_demo_tournament_seed.sql
db/seeds/002_demo_auth_seed.sql
modules/demo/demo-auth.service.ts
modules/demo/demo-session.ts
modules/demo/tournament-demo.service.ts
modules/arena/components/arena-live-view.tsx
modules/auth/services/auth.action.ts
app/api/demo/tournaments/[slug]/join/route.ts
```

## Reset Rapido De La Demo

Si quieres volver a un estado limpio, baja el volumen de Postgres y vuelve a sembrar.

```bash
docker compose down -v
pnpm db:demo
pnpm dev
```

Esto elimina datos previos de posiciones, participantes adicionales y eventos generados durante pruebas.

## Riesgos Para La Presentacion

- Si se usa el bridge real, puede fallar por conectividad, token, endpoint o reglas del broker.
- El cierre de posiciones del bridge real puede no estar completamente resuelto; la demo mantiene el cierre local como fallback.
- Si se corre `pnpm db:seed` sin limpiar la DB, algunos datos se actualizan, pero las posiciones/eventos generados durante pruebas pueden permanecer.
- Las credenciales demo no deben tratarse como credenciales productivas.
- `SESSION_SECRET` debe ser unico por ambiente y no debe exponerse al cliente.
