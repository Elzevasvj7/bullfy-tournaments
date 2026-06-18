---
name: Tournament Visual Gamification
description: Gamificación visual del Tournament — 4 fases COMPLETADAS (tabla animada, avatares 2D/3D, arena/TV estadio). Engine intacto.
type: feature
---
## Estado: Fases 0-4 COMPLETADAS

**Fase 0 - Cimientos (DONE):**
- `tournament_users.avatar_config jsonb` + `avatar_3d_url text` (nullable, aditivo).
- Tabla `tournament_equity_snapshots` (participant_id, tournament_id, equity, score, profit_pct, captured_at).
- Trigger `trg_tournament_capture_equity_snapshot` AFTER UPDATE en `tournament_participants` que inserta snapshot solo si cambia equity o score.
- Realtime habilitado en `tournament_participants` y `tournament_equity_snapshots`. REPLICA IDENTITY FULL.
- RLS: SELECT público en equity snapshots (datos de torneo son públicos).

**Fase 1 - Tabla En Vivo instagrameable (DONE):**
- `src/pages/tournament/TournamentLive.tsx` rediseñada con Framer Motion `layout` (filas se reordenan con spring).
- Suscripción Realtime al cambio de participants en lugar de polling de 15s (queda safety refresh cada 30s).
- Confetti (`canvas-confetti`) al cambiar el líder.
- Componente `TournamentPodium` para Top 3 con corona animada, pillares con altura graduada, glow pulse en #1.
- Sparklines de equity (Recharts) por fila vía `EquitySparkline` que lee `tournament_equity_snapshots`.
- "Mi posición" highlight card si el usuario está en el torneo.
- Export a Instagram Story 1080x1920 vía `html-to-image` con `StoryCardExport`.

## Pendiente

**Fase 2 - Avatares 2D personalizables:**
- DiceBear editor en `/tournament/avatar` (ruta nueva).
- Componente `<TournamentAvatar config animated emotion />` reutilizable.
- Estados: idle, happy (P/L>0), worried (P/L<0), ko (liquidado), celebrate (sube ranking).

**Fase 3 - Avatares 3D (Ready Player Me + R3F):**
- Versión <=8 de @react-three/fiber, <=9 de drei.
- Solo en podio Top 3, perfil público y arena.
- Fallback automático a 2D en móvil.

**Fase 4 - Experiencia estadio:**
- Live trade ticker (Realtime sobre snapshots).
- Achievement popups flotantes.
- Arena 3D `/tournament/t/:slug/arena`.
- TV Mode `/tournament/t/:slug/tv` (rotación automática para proyección).
- Cinemática épica al +10% en un trade.

## Garantías de no-regresión
- Cero modificaciones al engine (`tournament-engine-tick`).
- Cero modificaciones a tablas existentes (solo columnas nuevas nullable).
- El chat (`TournamentChat`) y el contrato de datos siguen idénticos.
