# Pendiente: Modo Mega Live Nativo (10K+ viewers sin YouTube)

**Estado:** 📋 Pendiente de aprobación e inicio
**Fecha de propuesta:** 2026-05-01
**Prioridad:** Media-Alta (capacidad de escala)

## Objetivo
Soportar 10,000 viewers simultáneos en un mismo stream (o repartidos) manteniendo video/audio nativo dentro de Bullfy Live, con chat, reacciones, polls, CTAs, leads y monetización funcionando — sin depender de YouTube ni plataformas externas.

## Decisiones pendientes del usuario
1. ¿Pagar upgrade LiveKit Cloud (Build plan ~$50/mes + HLS minutes)?
2. ¿Activar Upstash Redis (gratis hasta 10K cmd/día, $10/mes después)?
3. ¿Modo Mega Live siempre activo o sólo bajo demanda (>300 viewers)?
4. ¿Empezar por Fase 1 o hacer prueba de carga primero del sistema actual?

## Fases del plan

### Fase 1 — Distribución de video (LiveKit HLS Egress nativo)
- Activar HLS Egress en LiveKit Cloud (CDN nativa).
- Detectar viewers >300 → conmutar reproductor a HLS en lugar de WebRTC.
- Reproductor HLS embebido en `LiveStreamViewer` (hls.js).
- Mantener WebRTC sólo para host + co-hosts + primeros 300 viewers VIP.

### Fase 2 — Chat y Realtime escalable
- Fusionar canales Supabase Realtime (chat + reacciones + presence + polls + CTAs en 1-2 canales en lugar de 6+).
- Throttling de reacciones (batch cada 500ms en cliente).
- Particionar chat por buckets de 1000 viewers si se supera límite Realtime.
- Mover presence count a Redis (Upstash) con flush a Postgres cada 30s.

### Fase 3 — Presence y leads sin saturar Postgres
- Migrar `live_viewer_presence` writes a cola (Upstash QStash o Edge Function batch).
- Insertar en lotes de 100 cada 10s en lugar de 1 insert por viewer.
- Mantener tracking de duración exacto vía Redis sorted sets.

### Fase 4 — Auto-scaling y conmutación
- Hook `useMegaLiveMode` que detecta viewer count y cambia transporte.
- Banner para host: "Modo Mega Live activo — 1,200 viewers en HLS".
- Fallback automático a WebRTC si HLS falla.

### Fase 5 — Métricas y monitoreo
- Dashboard ops con: viewers WebRTC vs HLS, latencia, drops, costo en vivo.
- Alertas si viewer count >5K para preparar infra.

## Costos estimados (mensual)
- LiveKit Build plan: ~$50 base
- LiveKit HLS minutes: ~$0.005/min/viewer → 10K viewers x 60min = ~$3,000/evento grande
- Upstash Redis: $0-10/mes hasta cargas medias
- Supabase Realtime upgrade (si se necesita): incluido en Pro
- **Total estimado evento de 10K x 1h:** ~$3,050
- **Total mensual base (sin eventos masivos):** ~$60-80

## Archivos a tocar (estimado)
- `supabase/functions/livekit-egress-start/` (nuevo modo HLS)
- `supabase/functions/livekit-megalive-detect/` (nuevo)
- `src/components/live/LiveStreamViewer.tsx` (conmutación HLS)
- `src/components/live/MegaLiveBanner.tsx` (nuevo)
- `src/hooks/useMegaLiveMode.ts` (nuevo)
- `src/hooks/useViewerPresence.ts` (batch a Redis)
- Tabla nueva: `live_megalive_events` para métricas

## Notas
- NO usar YouTube/Twitch restream — explícito del usuario.
- Mantener experiencia nativa Bullfy en todo momento.
- HLS añade ~10-20s de latencia para los viewers en modo masivo (aceptable para >300 personas).
