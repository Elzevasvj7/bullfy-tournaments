-- ============================================================================
-- Fase 3 / P6 — Observabilidad: tabla de auditoría financiera transversal
-- ----------------------------------------------------------------------------
-- Hoy la trazabilidad del dinero está fragmentada (portal_payment_transactions
-- solo pasarela, nowpayments su propia tabla, MLM otra) y los ERRORES de las
-- edge functions de dinero solo van a stdout (efímero, no consultable). No se
-- puede responder en una consulta "todos los movimientos de dinero con su
-- resultado y error". Esta tabla es el log único de eventos financieros: las
-- edge functions escriben aquí (inicio/éxito/fallo) vía un helper best-effort.
-- Idempotente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.financial_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  function_name   TEXT NOT NULL,                 -- edge function origen
  event_type      TEXT NOT NULL,                 -- p.ej. order_paid, commission_credited, withdrawal_failed, deposit_created
  gateway         TEXT,                          -- coinsbuy | stripe | nowpayments | null
  portal_id       UUID,
  order_id        UUID,
  withdrawal_id   UUID,
  partner_user_id UUID,
  amount          NUMERIC(14,2),
  currency        TEXT,
  result          TEXT NOT NULL DEFAULT 'success' CHECK (result IN ('success','failed','skipped')),
  error_message   TEXT,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_events_occurred ON public.financial_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_events_portal   ON public.financial_events (portal_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_order    ON public.financial_events (order_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_result   ON public.financial_events (result);

ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

-- Lectura solo para staff (auditoría sensible). La escritura la hacen las edge
-- functions con service_role (bypassa RLS). Sin policies de INSERT/UPDATE para
-- anon/authenticated → no pueden escribir ni leer (salvo admins).
DROP POLICY IF EXISTS "financial_events: staff read" ON public.financial_events;
CREATE POLICY "financial_events: staff read" ON public.financial_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

GRANT SELECT ON public.financial_events TO authenticated;
GRANT ALL ON public.financial_events TO service_role;
