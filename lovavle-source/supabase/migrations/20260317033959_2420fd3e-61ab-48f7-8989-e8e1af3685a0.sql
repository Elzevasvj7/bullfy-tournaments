
-- Allow operaciones role to read all profiles (needed for bitácora solicitante names)
CREATE POLICY "Operaciones can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operaciones'::app_role));
