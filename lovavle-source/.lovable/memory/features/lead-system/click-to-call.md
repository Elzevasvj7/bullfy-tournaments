# Memory: features/lead-system/click-to-call
Updated: 2026-04-09

El Lead System incluye un sistema Click-to-Call integrado con Twilio Voice:
- **Modo Bridge**: Twilio llama al teléfono de trabajo del agente, luego conecta con el lead. Requiere que el agente configure su `telefono_trabajo` en el panel.
- **Modo Browser (WebRTC)**: El agente llama directamente desde el navegador usando `@twilio/voice-sdk`. Requiere secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`. Edge functions: `twilio-browser-token` (genera Access Token con VoiceGrant), `twilio-voice-webhook` (TwiML App callback, `verify_jwt=false`). Hook: `useBrowserCall` maneja el Device y las llamadas.
- **Mensaje de bienvenida**: Campo `welcome_message` en `sales_agent_status`. Se usa en el TwiML `<Say>` tanto en bridge como browser. Configurable desde el Panel de Agente.
- **Grabación**: Todas las llamadas se graban automáticamente (`record-from-answer-dual`). La URL de grabación se almacena en `lead_calls.recording_url`.
- **Post-llamada**: Al terminar, el agente completa un formulario de disposición obligatorio.
- **Panel de Agente**: Toggle de disponibilidad, métricas diarias, configuración de teléfono, modo preferido y mensaje de bienvenida.
- **Panel Supervisor** (admin_ventas): Vista en tiempo real de todos los agentes, asignación manual de leads, botón de auto-asignación round-robin por score.
- Tablas: `sales_agent_status` (realtime, welcome_message), `lead_calls`, `lead_assignments`.
- Edge Functions: `twilio-click-to-call`, `twilio-call-status`, `twilio-browser-token`, `twilio-voice-webhook`.
- El botón de llamar aparece en las tarjetas del Kanban y en el diálogo de detalle del lead. Muestra ícono Globe para browser mode.
