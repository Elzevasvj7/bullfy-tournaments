---
name: QA Karlos - Tournament Audit
description: Estado de PRs externos de Karlos (QA) sobre módulo Torneos. Invariantes a no revertir.
type: constraint
---

# QA Karlos — Auditoría Torneos (CERRADA)

Karlos hace QA/refactor externo: edita repo → PR → Merge → Publish desde Lovable. Notifica por chat. Auditoría completa cerrada con PRs #2–#9 publicados en main + bullfytech.online.

## Publicados (NO REVERTIR sin confirmación de Karlos)

### PR #2 — Stripe
Webhook HMAC-SHA256 + tolerancia 5min. `pay-create` solo acepta `type=wallet_topup`. Botón "Tarjeta" eliminado de wallet.

### PR #3 — Coinsbuy
Verificación server-to-server al proxy. `coinsbuy-callback` idempotente con `WHERE payment_status='pending'`.

### PR #4
`target_amount_requested` + detección mismatch monto solicitado/acreditado. Enum `prize_payout` completado.

### PR #5 — UX (7 fixes)
- B1/TOR-19: destructurar `loading` de `useTournamentAuth` (6 páginas)
- B2: alias `clanId` en TournamentClanDetail (ruta `clans/:clanId`)
- C5: eliminado `update({})` vacío en versus-respond
- C6: errores inscripción → `await` + `console.error`
- C7: clan-leave promueve **officer** con `ASC: false`
- D3: public-profile mensaje unificado "no encontrado"/"privado"
- D6: links a perfil en rankings

### PR #6 — Cron auth
`requireServiceRole` helper (acepta `X-Cron-Secret`, `SERVICE_ROLE_KEY`, `TOURNAMENT_CRON_SECRET`) en 6 cron EFs. `versus-clanwar-settle` con lock `.neq("status","finished")`. `clan-rankings-refresh` usa **upsert** (no delete+insert).

### PR #7 — Bombas financieras (pre-prod Coinsbuy)
- **A1**: clan-war-challenge/respond lockean stake; settle consume locked y reparte pot real; trigger SQL desbloquea en reject/expired.
- **A3 + A4**: enums `clan_verify` y `user_verify`; INSERT payments con error+rollback debit; refund user-verify-review lee monto del payment.
- **A5**: `invite_code` fuera de alcance anon/authenticated; nueva EF `tournament-clan-get-invite-code` valida membresía; `clan-war-challenge` acepta `defender_invite_code`.
- **C3**: `escapeHtml` en `full_name` y `message` del email versus-create.
- **C4**: rollback versus-create vía RPC `tournament_wallet_unlock`.
- **C8**: `tournament-redeem` delega a RPC `tournament_redeem_atomic` (row locks + tx).
- **C9**: `tournament-clan-create` vía RPC `tournament_clan_create_atomic`.
- **C10**: `clan-manage` transfer_owner vía RPC `tournament_clan_transfer_owner`.

### PR #8 — Cleanup remanente
- **C2/TOR-18**: password MT5 no se devuelve al cliente ni se muestra en UI; solo por email (botón "Reenviar al email"). `mt5_password` fuera de alcance anon/authenticated.
- **D7**: `TournamentAvatar3D` llama `dispose()` + `forceContextLoss()` en unmount del Canvas. Logs `THREE.WebGLRenderer: Context Lost.` son **esperados** (síntoma del fix).
- **D8**: `/tournament-admin` para no-admins muestra Card + botón al dashboard.
- **D4b**: `tournament-rankings-refresh` upsert `onConflict: "user_id,scope,period"`.

### PR #9 (hotfix) — REVOKE column-level correcto
Las migraciones #7/#8 usaron `REVOKE SELECT (col)` que en Postgres NO surte efecto si hay GRANT a nivel tabla (default Supabase). Fix: `REVOKE SELECT ON tabla` + `GRANT SELECT (col1, col2, ...)` excluyendo columnas restringidas. DO block dinámico con `pg_attribute`. Verificado con `has_column_privilege`: `invite_code` y `mt5_password` retornan false para anon/authenticated.

## Invariantes (no tocar sin orden)

1. `requireServiceRole` en cron EFs tournament
2. `.neq("status","finished")` en `tournament-versus-clanwar-settle`
3. `upsert` en `tournament-clan-rankings-refresh` y `tournament-rankings-refresh` (no delete+insert)
4. `authLoading` guards en páginas tournament
5. RPCs atómicas (NO read-modify-write para wallets): `tournament_wallet_unlock`, `tournament_wallet_consume_locked`, `tournament_redeem_atomic`, `tournament_clan_create_atomic`, `tournament_clan_transfer_owner`
6. Trigger `tournament_clan_war_unlock_trigger` (desbloqueo automático)
7. `escapeHtml` en versus-create (full_name, message)
8. Column-level grants en `tournament_clans` y `tournament_participants`: SIN `invite_code` ni `mt5_password` para anon/authenticated
9. **Frontend que toca `tournament_clans` o `tournament_participants` DEBE usar columnas explícitas, NUNCA `select("*")`** — romperá por permisos column-level
10. `TournamentAvatar3D` Canvas con `onCreated` capturando renderer + cleanup `dispose()`/`forceContextLoss()`. Logs "Context Lost" son esperados.
11. MT5 password: solo viaja por email, nunca al cliente ni UI

## Infra pendiente

- `STRIPE_WEBHOOK_SECRET`: no configurado, no bloqueante (sin tráfico Stripe legítimo a torneos aún).

## Protocolo

Si una request entra en conflicto con cualquier fix publicado (#2–#9) o invariante, **pedir confirmación explícita** antes de modificar.
