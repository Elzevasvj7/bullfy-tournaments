# Memory: features/live-system/stream-analysis-ai
Updated: 2026-04-20

Sistema 'Bullfy Smart Stream Analysis':
- Transcripción Automática: La transcripción se activa automáticamente al iniciar cualquier stream, sin opción manual para el host. Utiliza el SDK `@elevenlabs/react` con `useScribe` y VAD.
- Instancia Única: El componente `AutoStreamTranscription` se monta UNA sola vez (oculto) en `MeetingHostShell` para evitar conflictos de micrófono. El tab "transcription" del panel solo muestra un mensaje informativo, no monta otra instancia.
- Persistencia Resiliente: Al finalizar el stream, `submitForAnalysis` primero hace UPSERT directo del transcript a `live_stream_analysis` con `processing_status='pending'` (operación rápida que no se cancela aunque el componente se desmonte). Luego invoca `analyze-stream-context` como best-effort.
- Trigger DB de respaldo: El trigger `trg_analyze_pending_stream` (función `trigger_analyze_pending_stream`) se dispara en INSERT/UPDATE de `live_stream_analysis` cuando `processing_status='pending'` y llama a `analyze-stream-context` vía `pg_net`. Esto garantiza que el análisis IA y la detección de keywords siempre se procesen aunque el navegador del host se cierre antes de tiempo.
- Análisis Post-Stream: La Edge Function `analyze-stream-context` procesa el transcrito mediante Gemini Flash para generar resumen estructurado (temas, FAQs, objeciones, productos).
- Detección de Palabras Clave: El sistema compara el transcrito contra palabras/frases configuradas en la tabla `live_alert_keywords`. Las detecciones se almacenan en `live_keyword_alerts` con el fragmento del transcrito donde aparece.
- Configuración de Alertas: Apartado "Alertas" en el dashboard de Bullfy Live (solo Admin/Global Admin) para gestionar palabras clave con categorías (compliance, ventas, riesgo, general).
- Visualización de Alertas:
  - En el detalle del lead (LeadDetailDialog): Panel de alertas mostrando palabras detectadas en streams donde participó el lead.
  - En Smart Call Dashboard: Sección global de alertas agrupadas por palabra, mostrando stream, IB y fecha.
- Integración CRM: Los resultados de análisis se almacenan en `live_stream_analysis` y se visualizan en el panel de 'Contexto del Stream' dentro del detalle del lead.
