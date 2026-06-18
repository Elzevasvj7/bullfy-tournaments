
-- Drop the restrictive admin policy that blocks non-admin reads
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create permissive policies instead
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));
