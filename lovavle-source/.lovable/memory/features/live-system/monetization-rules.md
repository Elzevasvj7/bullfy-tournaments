---
name: Live streamer monetization rules
description: Pago $1 por lead que estuvo presente todo el stream (±2 min en cada extremo). Solo aplica a hosts con rol ib_externo.
type: feature
---

## Política de pago por lead (Bullfy Live)

- **Solo aplica a hosts con rol `ib_externo`** (validado en trigger `calculate_stream_earnings`).
- **$1 por lead válido** (`live_monetization_config.dolares_por_lead`).
- **Lead válido = estuvo en la totalidad del stream**, definido como:
  - `joined_at <= started_at + 2 min` (entró desde el inicio)
  - `left_at IS NULL OR left_at >= ended_at - 2 min` (se quedó hasta el final)
  - Tolerancia de **2 minutos en cada extremo**.
- Lead identificado por `stream_lead_id` o `correo` (el que esté disponible) en `live_viewer_presence`.
- Las ganancias se acumulan **mensualmente** en `live_streamer_earnings` (una fila por host + period_start del mes).
- El recálculo se dispara automáticamente cuando un stream pasa a `status='ended'`.

## Bonos mensuales (acumulados sobre el mes)
- ≥50 streams: $300
- ≥100 viewers (suma única): $100
- ≥2000 reacciones: $200
- Rating mensual ≥4.0: $100
- Configurables en `live_monetization_config`; overrides por host en `live_streamer_monetization`.

## Conteo de viewers
- `live_rooms.max_viewers` y `peak_viewers` se actualizan vía trigger `trg_update_room_max_viewers` cada vez que se inserta una fila en `live_viewer_presence`.
- No depende del frontend.

## Fuente única para paneles
Los 3 paneles del Bullfy Live admin leen de `live_streamer_earnings`:
- **LiveStreamerStats** (Ranking)
- **LiveStreamerReports** (Reporte por streamer)
- **LiveEarningsDashboard** (Ganancias)
