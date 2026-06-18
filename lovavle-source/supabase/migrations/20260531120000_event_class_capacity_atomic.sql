-- ============================================================================
-- C5 — Cupos atómicos para eventos y clases del portal
-- ----------------------------------------------------------------------------
-- Problema: la inscripción a eventos/clases gratuitas la hace el cliente anon
-- directamente (INSERT en *_registrations). El único control de cupo vivía en
-- el frontend (isAtCapacity), que es TOCTOU: dos inscripciones concurrentes
-- pueden pasar el check a la vez y sobrevender el aforo.
--
-- Solución: trigger BEFORE INSERT que bloquea la fila del evento/clase
-- (SELECT ... FOR UPDATE) para serializar inscripciones concurrentes del mismo
-- evento, cuenta las inscripciones existentes y rechaza si se alcanzó el cupo.
-- Funciona para CUALQUIER vía (anon free, service_role de pago, staff).
--
-- capacity NULL = sin límite (no se valida).
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================================

-- ── Eventos ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cap   INTEGER;
  _count INTEGER;
BEGIN
  -- Lock de la fila del evento: serializa inscripciones concurrentes del mismo
  -- evento. La 2da transacción espera aquí hasta que la 1ra haga commit, y
  -- entonces ve el conteo actualizado → atomicidad real.
  SELECT capacity INTO _cap
  FROM public.portal_events
  WHERE id = NEW.event_id
  FOR UPDATE;

  -- Sin límite de cupo → no validar.
  IF _cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _count
  FROM public.portal_event_registrations
  WHERE event_id = NEW.event_id;

  IF _count >= _cap THEN
    RAISE EXCEPTION 'EVENT_FULL: aforo % alcanzado para el evento %', _cap, NEW.event_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_capacity ON public.portal_event_registrations;
CREATE TRIGGER trg_enforce_event_capacity
  BEFORE INSERT ON public.portal_event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();

-- ── Clases ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_class_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cap   INTEGER;
  _count INTEGER;
BEGIN
  SELECT capacity INTO _cap
  FROM public.portal_classes
  WHERE id = NEW.class_id
  FOR UPDATE;

  IF _cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _count
  FROM public.portal_class_registrations
  WHERE class_id = NEW.class_id;

  IF _count >= _cap THEN
    RAISE EXCEPTION 'CLASS_FULL: aforo % alcanzado para la clase %', _cap, NEW.class_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_class_capacity ON public.portal_class_registrations;
CREATE TRIGGER trg_enforce_class_capacity
  BEFORE INSERT ON public.portal_class_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_capacity();
