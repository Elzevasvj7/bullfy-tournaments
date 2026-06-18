-- 1) Permitir lectura de encuestas a TODOS (autenticados + anónimos invitados a streams)
DROP POLICY IF EXISTS "Authenticated read polls" ON public.live_meeting_polls;
CREATE POLICY "Anyone can read polls"
  ON public.live_meeting_polls FOR SELECT
  USING (true);

-- 2) Habilitar REPLICA IDENTITY FULL para que UPDATE de votos llegue por Realtime con payload completo
ALTER TABLE public.live_meeting_polls REPLICA IDENTITY FULL;