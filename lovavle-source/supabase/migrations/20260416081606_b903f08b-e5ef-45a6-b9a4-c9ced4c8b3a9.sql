
CREATE POLICY "Public can read commerce access"
ON public.portal_commerce_access
FOR SELECT
USING (true);
