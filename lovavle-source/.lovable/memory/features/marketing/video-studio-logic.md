# Memory: features/marketing/video-studio-logic
Updated: now
Updated: now

Arquitectura y Modelo de Negocio del AI Video Studio:
- Edición Automatizada: Utiliza Shotstack como motor externo para realizar cortes, aplicar subtítulos animados y convertir videos a formato vertical (9:16), integrando ElevenLabs para transcripción y Gemini 2.5 Pro para detección de momentos virales y "hooks". El watermark dice "Powered by Bullfy".
- Conectividad Social: El sistema permite la vinculación de cuentas de Instagram, TikTok y YouTube para publicación directa desde el dashboard, gestionada mediante OAuth y almacenamiento de credenciales en la tabla `portal_social_credentials` (por portal).
- Configuración por Portal: Cada IB tiene una sección "Redes Sociales" en su Partner Portal admin donde configura sus propias credenciales de API (Client ID / Client Secret) con guías paso a paso para cada plataforma. Esta sección solo es visible si un admin habilitó `video_studio_enabled` en el portal.
- Estrategia de Monetización y Control: Implementa un modelo por niveles (Free, Pro, Enterprise) para monetizar las capacidades de la IA. Los Global Admins aprueban el acceso habilitando `video_studio_enabled` en `partner_portals` y gestionan límites de uso mensual mediante la tabla `video_studio_usage_log`.
- Almacenamiento: Los activos procesados se guardan en el bucket `video-clips` y los metadatos en la tabla `video_clips`, facilitando el re-uso de grabaciones de Bullfy Live y materiales de marketing cargados manualmente.
- UI: Video Studio Dashboard disponible tanto en Marketing (admin) como en Partner Portal (IB, si tiene acceso habilitado). Incluye upload de video, análisis de impacto, detección de clips virales y generación automática con Shotstack.
