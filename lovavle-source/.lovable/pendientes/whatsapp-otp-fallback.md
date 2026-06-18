# WhatsApp OTP — Capa 4 de Fallback (PENDIENTE)

## Objetivo
Añadir WhatsApp como tercer canal de entrega del OTP de registro, después de SMS (Twilio) y email (Resend). Especialmente útil para LATAM donde la entrega de SMS es inestable.

## Flujo propuesto
1. Usuario ingresa teléfono → SMS vía Twilio (intento 1)
2. Reenvío SMS con cooldown 30s (intento 2) — ya implementado
3. Tras 2 reintentos fallidos, aparece botón "Enviar por WhatsApp" 📱 (NUEVO, junto al de email)
4. Twilio envía template aprobado vía WhatsApp Business API
5. Verificación con el mismo `verify-otp` (sin cambios)

## Requisitos previos (NO listos aún)
- [ ] Cuenta de **WhatsApp Business API** aprobada por Meta
- [ ] Número de WhatsApp dedicado registrado en Twilio (o sandbox para pruebas internas)
- [ ] **Template OTP aprobado** por Meta (categoría: Authentication). Ejemplo:
      `Tu código Bullfy es {{1}}. Expira en 5 minutos.`
- [ ] Variables de entorno nuevas:
  - `TWILIO_WHATSAPP_NUMBER` (formato `whatsapp:+1XXXXXXXXXX`)
  - `TWILIO_WHATSAPP_TEMPLATE_SID` (SID del template aprobado)

## Cambios técnicos a hacer cuando se active
### Edge function `send-sms-otp` (o nueva `send-whatsapp-otp`)
- Aceptar flag `force_whatsapp_fallback: true` en el body
- Endpoint Twilio: mismo `Messages.json` pero con `From=whatsapp:...` y `To=whatsapp:+...`
- Usar `ContentSid` (template aprobado) + `ContentVariables` con el OTP

### Frontend
- `OTPVerificationStep.tsx`: añadir prop `onForceWhatsAppFallback` y botón secundario tras 2 reintentos
- `PartnerRegisterForm.tsx`: handler `handleForceWhatsAppFallback` análogo al de email

## Estado actual
- ✅ Capa 1 (cooldown + reintento manual) — implementado
- ✅ Capa 2 (fallback automático a email cuando Twilio falla) — implementado y funciona en cualquier país
- ✅ Capa 3 (botón manual "Enviar por email" tras 2 reintentos) — implementado
- ⏸️ Capa 4 (WhatsApp) — **EN ESPERA** hasta tener WhatsApp Business + template aprobado

## Notas
- El sandbox de Twilio sirve para pruebas internas (los testers deben hacer "join" al sandbox), pero NO funciona para usuarios reales.
- Costo estimado: ~$0.005 USD por mensaje de autenticación en LATAM (más barato que SMS internacional).
- Una vez aprobado el template, la activación toma ~30 min de código.
