-- ============================================================================
-- PR Mux #1 — Schema para integración con Mux Video
-- ============================================================================
-- Migración del sistema de videos de Academy desde Supabase Storage hacia Mux.
-- Mantiene la columna legacy `video_path` para que las 23 lecciones existentes
-- sigan funcionando durante el periodo de transición (PR Mux #4 las migrará).
-- ============================================================================

-- Estados posibles del asset en Mux:
--   preparing → Mux está transcodeando (1-5 min típico)
--   ready     → playback_id disponible, reproducible
--   errored   → Mux falló al procesar el upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'academy_mux_status'
  ) THEN
    CREATE TYPE public.academy_mux_status AS ENUM ('preparing', 'ready', 'errored');
  END IF;
END
$$;


-- ----------------------------------------------------------------------------
-- Columnas Mux en academy_lessons
-- ----------------------------------------------------------------------------
ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS mux_asset_id          text,
  ADD COLUMN IF NOT EXISTS mux_playback_id       text,
  ADD COLUMN IF NOT EXISTS mux_status            public.academy_mux_status,
  ADD COLUMN IF NOT EXISTS mux_duration_seconds  numeric(10,3),
  ADD COLUMN IF NOT EXISTS mux_upload_id         text,
  ADD COLUMN IF NOT EXISTS mux_error_message     text;


-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
-- El webhook viene con asset_id; necesitamos buscar la lección rápido.
CREATE INDEX IF NOT EXISTS idx_academy_lessons_mux_asset_id
  ON public.academy_lessons (mux_asset_id)
  WHERE mux_asset_id IS NOT NULL;

-- Para asociar el upload inicial (cuando el asset_id aún no se conoce) al recibir
-- el evento video.upload.asset_created del webhook.
CREATE INDEX IF NOT EXISTS idx_academy_lessons_mux_upload_id
  ON public.academy_lessons (mux_upload_id)
  WHERE mux_upload_id IS NOT NULL;
