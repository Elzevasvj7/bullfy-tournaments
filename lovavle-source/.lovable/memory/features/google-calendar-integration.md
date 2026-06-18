---
name: Google Calendar Integration
description: Sistema OAuth para internos (@bullfy.com con Consent Screen Internal) + fallback .ics email para externos. Eventos de Bullfy Family Live, campañas IB y ops.
type: feature
---

# Google Calendar Integration

## Arquitectura
- **Internos `@bullfy.com`**: OAuth 2.0 con Consent Screen "Internal" (sin verificación Google, sin warnings).
- **Externos (IB con Gmail/Outlook)**: fallback automático a `.ics` por email vía Resend.
- Misma `google-calendar-sync` decide automáticamente el método según si user tiene `google_calendar_connections.active = true`.

## Edge Functions
- `google-oauth-init` (verify_jwt=true): genera URL de autorización OAuth con scope `calendar.events`. State firmado con base64(user_id+nonce+ts).
- `google-oauth-callback` (verify_jwt=false): intercambia code → tokens, upsert en `google_calendar_connections`, redirige a `/settings?google_calendar=connected`.
- `google-calendar-sync` (verify_jwt=false, llamado server-to-server): create/update/cancel. Auto-refresh de token vencido. Fallback `.ics` si falla Google API o no hay conexión.
- `send-calendar-ics` (verify_jwt=false): genera `.ics` RFC 5545 con UID/SEQUENCE/METHOD, lo envía adjunto vía Resend.

## Tablas
- `google_calendar_connections` (UNIQUE user_id+google_email): tokens OAuth.
- `calendar_events_log`: bitácora idempotente por (user_id, source_type, source_id) para correlacionar updates/cancels.

## UI
- `/settings` → tab "Google Calendar" (`GoogleCalendarSettings.tsx`): conectar, listar, toggle activar/pausar, desconectar.

## Configuración Google Cloud Console (manual del usuario)
1. OAuth Consent Screen → User Type: **Internal** (requiere Workspace bullfy.com)
2. Scopes: `https://www.googleapis.com/auth/calendar.events` + userinfo.email
3. Redirect URI: `https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/google-oauth-callback`
4. Authorized JS origins: `https://bullfytech.online`, `https://bullfyibsystem.lovable.app`

## Secrets requeridos
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `RESEND_API_KEY` (ya configurado, para .ics)

## Casos de uso pendientes de wiring
- Bullfy Live de Bullfy Family → al programar/iniciar, sync a todos los miembros invitados
- Campañas IB Marketing con `day_number` → al asignar IB, evento por cada tarea
- Ops requests con SLA → recordatorio al operador asignado

## Email del .ics
- Se envía desde `calendar@bullfytech.online` (verificar dominio en Resend si aún no está)
- Usa `METHOD:REQUEST` para crear/actualizar (mismo UID = update), `METHOD:CANCEL` para cancelar
