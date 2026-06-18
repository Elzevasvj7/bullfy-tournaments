
-- Function to close stale live rooms (no heartbeat for 15+ minutes)
CREATE OR REPLACE FUNCTION public.close_stale_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE live_rooms
  SET status = 'ended',
      ended_at = now(),
      updated_at = now()
  WHERE status IN ('live', 'waiting')
    AND updated_at < now() - interval '15 minutes';
END;
$$;

-- Schedule cron job every 5 minutes
SELECT cron.schedule(
  'close-stale-live-rooms',
  '*/5 * * * *',
  $$SELECT public.close_stale_rooms()$$
);
