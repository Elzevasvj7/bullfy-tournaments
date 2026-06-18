-- Allow any user (including portal client users authenticated via custom flow / anon)
-- to read MLM config of a portal. None of the fields are sensitive — they are
-- operational params that the client app needs in order to render the MLM section.
CREATE POLICY "Anyone can view portal MLM config"
ON public.portal_mlm_config
FOR SELECT
TO anon, authenticated
USING (true);