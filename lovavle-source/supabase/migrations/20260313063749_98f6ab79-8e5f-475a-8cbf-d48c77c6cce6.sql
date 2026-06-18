
-- Allow admin_operaciones to read user_roles (needed to find ops users for assignment)
CREATE POLICY "Ops admins can read roles for assignment"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin_operaciones'::app_role)
  );

-- Allow admin_operaciones to read profiles (needed to show names in assignment dropdown)
CREATE POLICY "Ops admins can read profiles for assignment"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin_operaciones'::app_role)
  );
