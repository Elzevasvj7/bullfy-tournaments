CREATE POLICY "Anon can read live rooms via invite code"
ON public.live_rooms
FOR SELECT
TO anon
USING (
  status = 'live'
  AND EXISTS (
    SELECT 1 FROM public.live_invite_codes
    WHERE live_invite_codes.room_id = live_rooms.id
      AND live_invite_codes.used_at IS NULL
      AND live_invite_codes.expires_at > now()
  )
);