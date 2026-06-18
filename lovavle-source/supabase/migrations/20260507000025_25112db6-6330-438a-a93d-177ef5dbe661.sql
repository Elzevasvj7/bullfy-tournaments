ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS auto_close_disabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.close_stale_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE live_rooms
  SET status = 'ended',
      ended_at = now(),
      updated_at = now()
  WHERE status IN ('live', 'waiting')
    AND updated_at < now() - interval '15 minutes'
    AND auto_close_disabled = false;
END;
$function$;