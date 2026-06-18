-- Allow anonymous users to read waiting templates (needed for waiting room viewer)
CREATE POLICY "Anon can read waiting templates"
ON public.live_waiting_templates
FOR SELECT
TO anon
USING (true);