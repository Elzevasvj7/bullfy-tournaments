# Pendiente: Telegram Login Widget como Fast Lane (ingreso rápido al stream)

**Estado:** 📋 Pendiente de análisis y decisión del usuario
**Fecha de propuesta:** 2026-05-27
**Prioridad:** Baja-Media (mejora UX para viewers recurrentes)

## Contexto
Actualmente el registro de stream (LiveGuest.tsx) tiene un flujo de verificación por OTP/email/phone seguido de un paso opcional/ obligatorio de vinculación con Telegram (Fase 5B implementada). Telegram ofrece un "Login Widget" oficial que permite a los usuarios autenticarse con su cuenta de Telegram en sitios web.

## Propuesta: Fast Lane opcional (no reemplazo)
Agregar un botón "Entrar con Telegram" al inicio del registro del stream que, mediante el Telegram Login Widget, permita:
- Autenticar al usuario vía Telegram (HMAC-SHA256 firmado por el bot token).
- Si el `telegram_user_id` ya existe en `stream_leads` → auto-verificar el lead y saltar OTP + vinculación.
- Si no existe → crear lead con flag `telegram_only=true` (nueva columna necesaria).
- Ir directamente a `connectToRoom()` sin pasar por email/phone.

## Ventajas
- Friction menor para viewers recurrentes que ya tienen Telegram.
- No pierden el historial de lead si ya se vinculó antes.

## Desventajas / Limitaciones
- Telegram NO expone email ni phone number en su Login Widget → leads creados solo por Telegram carecen de email/phone.
- Impacta CRM: stream_leads sin email/phone limitan campañas, WhatsApp, smart-call-ai, etc.
- Requiere registrar el dominio en BotFather (`bullfytech.online` o `bullfyibsystem.lovable.app`).

## Esfuerzo estimado
- ~1 sesión: 1 Edge Function nueva (`telegram-login-verify`), 1 columna (`stream_leads.telegram_only`), ~80 líneas en `LiveGuest.tsx`.

## Recomendación del sistema
Implementar como **opcional** (no reemplazo del flujo actual). Mostrar el botón "Entrar con Telegram" arriba del formulario email/phone. Si el usuario usa Fast Lane y es su primera vez, marcar el lead como "📱 Telegram-only" en el CRM para que el BD solicite email en la primera conversación.

## Notas
- No aplicar hasta orden explícita del usuario.
- Depende de que el bot `@bullfy_contact_bot` tenga el dominio registrado en BotFather.
- Relacionado con: Fase 5B (vinculación obligatoria de Telegram ya implementada).
