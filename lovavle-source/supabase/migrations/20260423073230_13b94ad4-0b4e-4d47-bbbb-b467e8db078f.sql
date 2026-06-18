CREATE POLICY "No direct select on trading room favorite symbols"
ON public.trading_room_favorite_symbols
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "No direct insert on trading room favorite symbols"
ON public.trading_room_favorite_symbols
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct update on trading room favorite symbols"
ON public.trading_room_favorite_symbols
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct delete on trading room favorite symbols"
ON public.trading_room_favorite_symbols
FOR DELETE
TO authenticated
USING (false);