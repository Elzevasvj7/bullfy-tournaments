CREATE POLICY "Anon can read newsletter editions for results page"
ON public.newsletter_editions
FOR SELECT
TO anon
USING (true);