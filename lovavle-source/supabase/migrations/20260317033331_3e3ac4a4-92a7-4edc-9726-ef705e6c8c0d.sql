
-- Allow admin_bd to read all profiles (to resolve names in bitácora)
CREATE POLICY "Admin BD can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin_bd'::app_role));

-- Allow admin_bd to read user_roles (to see ops users in bitácora)
CREATE POLICY "Admin BD can read user roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin_bd'::app_role));
