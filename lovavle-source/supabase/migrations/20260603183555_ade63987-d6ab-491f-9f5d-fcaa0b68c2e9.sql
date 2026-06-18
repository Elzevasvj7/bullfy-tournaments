
CREATE OR REPLACE FUNCTION public.lead_system_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_no_contact integer := 0;
  released_inactive integer := 0;
  rec record;
BEGIN
  -- 1) Auto-release: taken but never contacted within 30 min
  FOR rec IN
    SELECT id, assigned_to
    FROM public.stream_leads
    WHERE taken_at IS NOT NULL
      AND last_contact_at IS NULL
      AND closed_at IS NULL
      AND taken_at < now() - interval '30 minutes'
  LOOP
    UPDATE public.stream_leads
       SET assigned_to = NULL,
           assigned_at = NULL,
           taken_at = NULL,
           auto_reassign_count = auto_reassign_count + 1,
           updated_at = now()
     WHERE id = rec.id;

    INSERT INTO public.lead_activities(lead_id, performed_by, activity_type, details)
    VALUES (rec.id, NULL, 'auto_release', 'Liberado automaticamente: sin contacto en 30 min');
    released_no_contact := released_no_contact + 1;
  END LOOP;

  -- 2) Reassignment: assigned but inactive >5 days
  FOR rec IN
    SELECT id, assigned_to
    FROM public.stream_leads
    WHERE assigned_to IS NOT NULL
      AND closed_at IS NULL
      AND COALESCE(last_contact_at, taken_at, assigned_at) < now() - interval '5 days'
  LOOP
    UPDATE public.stream_leads
       SET assigned_to = NULL,
           assigned_at = NULL,
           taken_at = NULL,
           auto_reassign_count = auto_reassign_count + 1,
           updated_at = now()
     WHERE id = rec.id;

    INSERT INTO public.lead_activities(lead_id, performed_by, activity_type, details)
    VALUES (rec.id, NULL, 'auto_reassign', 'Reasignado automaticamente: 5 dias sin actividad');
    released_inactive := released_inactive + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'released_no_contact', released_no_contact,
    'released_inactive', released_inactive,
    'ts', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lead_system_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_system_tick() TO service_role;
