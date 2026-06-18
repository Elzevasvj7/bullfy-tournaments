# Memory: features/lead-system/smart-call-ai
Updated: now

'Bullfy Smart Call' es un sistema de análisis y entrenamiento de llamadas impulsado por IA:
- **Procesamiento**: Edge Function `analyze-call-recording` que usa Lovable AI (Gemini 3 Flash) con tool calling para extraer datos estructurados. Se dispara automáticamente desde `PostCallForm` al guardar la disposición post-llamada.
- **Almacenamiento**: Tabla `lead_call_analysis` con transcription, summary, success_score (0-100), sentiment, keywords, sales_phase_reached, objections_detected/handled, improvement_suggestions, coaching_notes y processing_status (pending/processing/completed/error).
- **Visualización - Lead**: Componente `CallAnalysisPanel` integrado en `CallHistory.tsx` que muestra análisis expandible por cada llamada completada (score, sentimiento, fase alcanzada, objeciones, sugerencias, coaching).
- **Visualización - Supervisor**: Tab "Smart Call" en `LeadSystemDashboard` con componente `SmartCallDashboard` que muestra KPIs globales (score promedio, tasa de manejo de objeciones), ranking de agentes, distribución de fases/sentimiento, objeciones frecuentes y áreas de mejora comunes.
- **Metodología**: La IA evalúa basándose en las fases Bullfy (Apertura, Sondeo, Presentación, Objeciones, Cierre) y cruza con el catálogo `bce_objections`.
- **Acceso**: Tab visible para admin, global_admin y admin_ventas.
