-- ============================================================================
-- C7 (anti email-bombing) — Log de notificaciones para deduplicar envíos
-- ----------------------------------------------------------------------------
-- portal-notifications es invocable por anon y valida que el hecho ocurrió,
-- pero sin dedup era replayable: conocido un UUID válido, reenviar el POST N
-- veces disparaba N emails reales (bombardeo al IB/usuario + costo/reputación
-- Resend). Esta tabla permite "reclamar" cada notificación de forma atómica:
-- el dispatcher hace INSERT con UNIQUE(event, ref_key) ANTES de enviar; si
-- choca (23505) significa que ya se envió y se omite. Así cada (event, ref_key)
-- se envía a lo sumo una vez.
-- Idempotente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.portal_notification_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event      TEXT NOT NULL,
  ref_key    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event, ref_key)
);

ALTER TABLE public.portal_notification_log ENABLE ROW LEVEL SECURITY;
-- Solo service_role la usa (desde la edge function). Sin policies → anon/auth
-- no tienen acceso directo; service_role bypassa RLS.
GRANT ALL ON public.portal_notification_log TO service_role;
