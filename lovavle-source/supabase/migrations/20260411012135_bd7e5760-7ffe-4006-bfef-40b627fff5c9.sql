CREATE POLICY "Anon can read public stream rooms"
ON public.live_rooms
FOR SELECT
TO anon
USING (is_public_stream = true);