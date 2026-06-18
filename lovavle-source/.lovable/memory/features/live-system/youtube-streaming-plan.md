# Memory: features/live-system/youtube-streaming-plan
Updated: now

Integración con YouTube Live completada. El sistema Bullfy Live permite re-transmisión simultánea a YouTube mediante LiveKit Web Egress. Arquitectura:

1. **Compositor** (`/live-egress/:roomName`): Página dedicada que se conecta como participante invisible (`egress-compositor`) con token subscribe-only. Renderiza el video + todos los efectos visuales (ViewerCTABanner, ViewerAdBanner, OverlayDisplay, ViewerTickerStrip, ViewerNewsTickerStrip) a 1920×1080.

2. **Edge Function** (`youtube-restream`): Controlador autenticado que invoca la API de LiveKit Server (`StartWebEgress` / `StopEgress`) para capturar la URL del compositor y enviarla vía RTMP a `rtmp://a.rtmp.youtube.com/live2/{STREAM_KEY}`.

3. **Panel del Host** (`YouTubeRestreamPanel`): Widget en el sidebar izquierdo del host que permite ingresar la Stream Key de YouTube, iniciar y detener el restream. La clave se maneja en memoria, no se persiste.

4. **Token Egress**: El `livekit-token` fue extendido con un role `"egress"` que no requiere autenticación y genera un token subscribe-only con TTL de 2h.

Paridad visual: 100% — todo lo que ven los espectadores en Bullfy Live aparece en YouTube y queda grabado. Latencia YouTube: ~15-30s.
