
-- F3 Lead System 2.0 — Round-robin equitativo torneos
-- Crea assign_tournament_lead + trigger AFTER INSERT en stream_leads (source='tournament')
-- y extiende lead_system_tick para reintentar leads de torneo sin asignar.

CREATE OR REPLACE FUNCTION public.assign_tournament_lead(_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closer uuid;
  _lead stream_leads%ROWTYPE;
BEGIN
  SELECT * INTO _lead FROM public.stream_leads WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _lead.assigned_to IS NOT NULL THEN RETURN _lead.assigned_to; END IF;
  IF _lead.source IS DISTINCT FROM 'tournament' THEN RETURN NULL; END IF;

  -- Pool: usuarios con rol 'ventas' y disponibles (si existe registro en sales_agent_status)
  WITH pool AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    LEFT JOIN public.sales_agent_status sas ON sas.user_id = ur.user_id
    WHERE ur.role = 'ventas'
      AND (sas.user_id IS NULL OR sas.is_available = true)
  ),
  counts AS (
    SELECT p.user_id,
           COALESCE((
             SELECT COUNT(*) FROM public.stream_leads sl
             WHERE sl.assigned_to = p.user_id
               AND sl.source = 'tournament'
               AND sl.created_at > now() - interval '30 days'
           ), 0) AS load
    FROM pool p
  )
  SELECT user_id INTO _closer
  FROM counts
  ORDER BY load ASC, random()
  LIMIT 1;

  IF _closer IS NULL THEN
    RETURN NULL; -- queda pendiente; el tick reintentará
  END IF;

  UPDATE public.stream_leads
     SET assigned_to = _closer,
         assigned_at = now(),
         assigned_by = NULL
   WHERE id = _lead_id;

  INSERT INTO public.lead_assignments (lead_id, assigned_to, assigned_by, assignment_method, created_at)
  VALUES (_lead_id, _closer, NULL, 'tournament_round_robin', now());

  INSERT INTO public.lead_activities (lead_id, user_id, activity_type, description, created_at)
  VALUES (_lead_id, _closer, 'tournament_auto_assign',
          'Asignado por round-robin equitativo de torneo', now());

  RETURN _closer;
END;
$$;

-- Trigger AFTER INSERT
CREATE OR REPLACE FUNCTION public.trg_assign_tournament_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'tournament' AND NEW.assigned_to IS NULL THEN
    PERFORM public.assign_tournament_lead(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stream_leads_tournament_assign ON public.stream_leads;
CREATE TRIGGER trg_stream_leads_tournament_assign
AFTER INSERT ON public.stream_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_assign_tournament_lead();

-- Extender lead_system_tick para reintentar leads de torneo sin asignar
CREATE OR REPLACE FUNCTION public.lead_system_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _released int := 0;
  _reassigned int := 0;
  _tournament_retried int := 0;
  _rec record;
BEGIN
  -- 1) Auto-release: tomado hace >30 min sin contacto
  WITH to_release AS (
    SELECT id, assigned_to FROM public.stream_leads
    WHERE assigned_to IS NOT NULL
      AND taken_at IS NOT NULL
      AND last_contact_at IS NULL
      AND taken_at < now() - interval '30 minutes'
      AND source <> 'tournament'
  ), upd AS (
    UPDATE public.stream_leads sl
       SET assigned_to = NULL, taken_at = NULL
      FROM to_release tr
     WHERE sl.id = tr.id
     RETURNING sl.id, tr.assigned_to
  )
  INSERT INTO public.lead_activities (lead_id, user_id, activity_type, description, created_at)
  SELECT id, assigned_to, 'auto_release', 'Auto-liberado por inactividad (30 min sin contacto)', now()
  FROM upd;
  GET DIAGNOSTICS _released = ROW_COUNT;

  -- 2) Reasignación 5 días sin cierre (Bullfy Live)
  FOR _rec IN
    SELECT id, partner_portal_id, assigned_to
    FROM public.stream_leads
    WHERE assigned_to IS NOT NULL
      AND source <> 'tournament'
      AND assigned_at < now() - interval '5 days'
      AND closed_at IS NULL
      AND COALESCE(auto_reassign_count, 0) < 1
  LOOP
    UPDATE public.stream_leads
       SET assigned_to = NULL,
           taken_at = NULL,
           auto_reassign_count = COALESCE(auto_reassign_count, 0) + 1
     WHERE id = _rec.id;
    INSERT INTO public.lead_activities (lead_id, user_id, activity_type, description, created_at)
    VALUES (_rec.id, _rec.assigned_to, 'auto_reassign',
            'Liberado tras 5 días sin cierre', now());
    _reassigned := _reassigned + 1;
  END LOOP;

  -- 3) Reintento asignación torneo
  FOR _rec IN
    SELECT id FROM public.stream_leads
    WHERE source = 'tournament' AND assigned_to IS NULL
    ORDER BY created_at ASC
    LIMIT 200
  LOOP
    IF public.assign_tournament_lead(_rec.id) IS NOT NULL THEN
      _tournament_retried := _tournament_retried + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'released', _released,
    'reassigned', _reassigned,
    'tournament_retried', _tournament_retried,
    'at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_tournament_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_tournament_lead(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.lead_system_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_system_tick() TO service_role;
