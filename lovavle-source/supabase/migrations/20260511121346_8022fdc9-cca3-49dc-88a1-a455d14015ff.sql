
CREATE OR REPLACE FUNCTION public.close_stale_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Salas en espera: cerrar tras 48h sin actividad
  UPDATE live_rooms
  SET status = 'ended',
      ended_at = now(),
      updated_at = now()
  WHERE status = 'waiting'
    AND updated_at < now() - interval '48 hours'
    AND auto_close_disabled = false;

  -- Salas en vivo: mantener cierre tras 15 min sin actividad (protege contra streams fantasma)
  UPDATE live_rooms
  SET status = 'ended',
      ended_at = now(),
      updated_at = now()
  WHERE status = 'live'
    AND updated_at < now() - interval '15 minutes'
    AND auto_close_disabled = false;
END;
$$;
