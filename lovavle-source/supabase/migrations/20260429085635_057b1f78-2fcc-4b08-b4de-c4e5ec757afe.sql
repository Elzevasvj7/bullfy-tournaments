-- 1. Tabla de segmentos de traducción
CREATE TABLE public.live_translation_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  host_id UUID NOT NULL,
  original_text TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'es',
  segment_index BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_translation_segments_room ON public.live_translation_segments(room_id, created_at DESC);

ALTER TABLE public.live_translation_segments ENABLE ROW LEVEL SECURITY;

-- Lectura pública (viewers e invitados pueden suscribirse)
CREATE POLICY "Anyone can read translation segments"
ON public.live_translation_segments
FOR SELECT
USING (true);

-- Solo el host autenticado puede insertar para su propia sala
CREATE POLICY "Host can insert own translation segments"
ON public.live_translation_segments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_id);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_translation_segments;
ALTER TABLE public.live_translation_segments REPLICA IDENTITY FULL;

-- Auto-purga de segmentos viejos (>24h) para no acumular datos
CREATE OR REPLACE FUNCTION public.cleanup_old_translation_segments()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.live_translation_segments WHERE created_at < now() - INTERVAL '24 hours';
$$;