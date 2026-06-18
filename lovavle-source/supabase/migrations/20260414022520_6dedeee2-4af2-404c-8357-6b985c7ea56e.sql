-- Fix: Allow anon portal users to see rooms in 'waiting' status too
DROP POLICY "Anon can read active rooms for portal" ON public.live_rooms;

CREATE POLICY "Anon can read active rooms for portal"
  ON public.live_rooms
  FOR SELECT
  TO anon
  USING (
    status IN ('live', 'waiting')
    AND portal_id IS NOT NULL
  );