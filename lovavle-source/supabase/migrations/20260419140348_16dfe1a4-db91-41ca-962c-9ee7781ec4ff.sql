CREATE POLICY "Anon can read meeting rooms for knock"
ON public.live_rooms
FOR SELECT
TO anon
USING (
  room_type IN ('meeting', 'webinar_pro', 'bullfy_family')
  AND status = ANY (ARRAY['live'::text, 'waiting'::text])
);