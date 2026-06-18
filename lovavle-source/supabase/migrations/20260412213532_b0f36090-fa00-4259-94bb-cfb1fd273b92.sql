DROP POLICY "Anon can read live rooms via invite code" ON public.live_rooms;

CREATE POLICY "Anon can read rooms via invite code"
ON public.live_rooms
FOR SELECT
USING (
  status IN ('live', 'waiting')
  AND EXISTS (
    SELECT 1 FROM live_invite_codes
    WHERE live_invite_codes.room_id = live_rooms.id
      AND live_invite_codes.expires_at > now()
      AND (live_invite_codes.is_public = true OR live_invite_codes.used_at IS NULL)
  )
);
